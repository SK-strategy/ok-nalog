import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { components, internal } from './_generated/api'
import { action, internalMutation, internalQuery, mutation } from './_generated/server'
import { getUser, requireAdmin } from './lib/auth'
import { sendEmail } from './lib/email'

// ─────────────────────────────────────────────────────────────────────────────
// Account merge: collapse a duplicate (auth user + domain user) pair D into a
// survivor S across BOTH row-spaces, then delete D. A person ends up with two
// identities when a silent TMA auto-signin (Telegram-born) and a web email
// sign-up (email-born) happen before they ever link. Linking then collides;
// these flows turn the dead-end into a merge once the same human has PROVEN
// control of both identities (web: live session + Telegram OAuth; TMA/web
// email: live session + an OTP delivered to the contested inbox).
//
// The whole merge is ONE domain mutation (`mergeUsers`): domain-table edits go
// through `ctx.db`; auth-table edits route through the better-auth component's
// adapter via `ctx.runMutation(components.betterAuth.adapter.*)`. Both run in
// the same Convex transaction, so it is atomic — it fully commits or fully
// rolls back; we never half-merge. Best-practice guards (money safety,
// telegram divergence, self-order, verify-before-delete) gate it.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_RANK = { customer: 0, executor: 1, admin: 2 } as const
type Role = Doc<'users'>['role']
const maxRole = (a: Role, b: Role): Role => (ROLE_RANK[a] >= ROLE_RANK[b] ? a : b)

// Domain `users.email` only ever holds a real address (the mirror strips the
// `${telegramId}@telegram.local` placeholder to undefined); the auth `user`
// row keeps the placeholder, so check both shapes.
const isPlaceholderEmail = (e?: string | null): boolean => !e || e.endsWith('@telegram.local')

// Short window between the OAuth-proved collision (candidate written) and the
// user clicking «объединить» — kept tight to limit stale-proof replay.
const CANDIDATE_TTL_MS = 10 * 60 * 1000
const OTP_TTL_MS = 10 * 60 * 1000
const MAX_OTP_ATTEMPTS = 5 // failed guesses per code
const MAX_CUMULATIVE_OTP_ATTEMPTS = 15 // failed guesses across resends → locked until expiry
const MERGE_OTP_RESEND_MS = 60 * 1000 // server-side resend cooldown (mirrors the client's)

interface AuthAccount {
  _id: string
  userId: string
  accountId: string
  providerId: string
}

// Paginate the better-auth component's `account` table for one auth user.
async function listAuthAccounts(ctx: MutationCtx, authUserId: string): Promise<AuthAccount[]> {
  const out: AuthAccount[] = []
  let cursor: string | null = null
  for (;;) {
    const res = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: 'account',
      where: [{ field: 'userId', value: authUserId }],
      paginationOpts: { cursor, numItems: 200 },
    })) as { page: AuthAccount[]; isDone: boolean; continueCursor: string }
    out.push(...res.page)
    if (res.isDone) break
    cursor = res.continueCursor
  }
  return out
}

// Pick which of two executor profiles to keep: approved beats pending/rejected,
// then the older one (more established).
function pickKeeperProfile(
  a: Doc<'executorProfiles'>,
  b: Doc<'executorProfiles'>,
): Doc<'executorProfiles'> {
  const rank = (s: Doc<'executorProfiles'>['status']) =>
    s === 'approved' ? 2 : s === 'pending' ? 1 : 0
  if (rank(a.status) !== rank(b.status)) return rank(a.status) > rank(b.status) ? a : b
  return a.createdAt <= b.createdAt ? a : b
}

/**
 * Deterministic survivor choice for admin-driven merges (the self-serve flows
 * pin the survivor to the live session user instead, see requestSelfMerge /
 * confirmEmailMerge). Priority: privilege > has-real-email > older account.
 */
export function decideSurvivor(
  a: Doc<'users'>,
  b: Doc<'users'>,
): { survivor: Doc<'users'>; duplicate: Doc<'users'> } {
  if (ROLE_RANK[a.role] !== ROLE_RANK[b.role]) {
    return ROLE_RANK[a.role] > ROLE_RANK[b.role]
      ? { survivor: a, duplicate: b }
      : { survivor: b, duplicate: a }
  }
  if (!!a.email !== !!b.email) {
    return a.email ? { survivor: a, duplicate: b } : { survivor: b, duplicate: a }
  }
  return a.createdAt <= b.createdAt ? { survivor: a, duplicate: b } : { survivor: b, duplicate: a }
}

/**
 * The merge core. Internal — only reachable from the gated wrappers below or an
 * admin. Idempotent: a re-run after the duplicate is gone returns cleanly.
 */
export const mergeUsers = internalMutation({
  args: {
    survivorUserId: v.id('users'),
    duplicateUserId: v.id('users'),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { survivorUserId, duplicateUserId, force }) => {
    if (survivorUserId === duplicateUserId) {
      throw new ConvexError({
        code: 'SAME_USER',
        message: 'Нельзя объединить пользователя с собой',
      })
    }
    const D = await ctx.db.get(duplicateUserId)
    if (!D) return { status: 'already-merged' as const, survivorUserId }
    const S = await ctx.db.get(survivorUserId)
    if (!S) throw new ConvexError({ code: 'NOT_FOUND', message: 'Выживший аккаунт не найден' })

    // ── guards (no writes before these pass) ────────────────────────────────
    // Two different real Telegram ids = two different people, never a duplicate.
    if (S.telegramId && D.telegramId && S.telegramId !== D.telegramId) {
      throw new ConvexError({
        code: 'TELEGRAM_CONFLICT',
        message: 'Это разные Telegram-аккаунты — объединение невозможно',
      })
    }

    const sProf = await ctx.db
      .query('executorProfiles')
      .withIndex('by_user', (q) => q.eq('userId', S._id))
      .unique()
    const dProf = await ctx.db
      .query('executorProfiles')
      .withIndex('by_user', (q) => q.eq('userId', D._id))
      .unique()

    // Money safety: two funded executor ledgers must be reconciled by a human.
    if (sProf && dProf && !force) {
      const dTx = await ctx.db
        .query('transactions')
        .withIndex('by_executor', (q) => q.eq('executorProfileId', dProf._id))
        .first()
      const sTx = await ctx.db
        .query('transactions')
        .withIndex('by_executor', (q) => q.eq('executorProfileId', sProf._id))
        .first()
      if (sProf.balance > 0 || dProf.balance > 0 || dTx || sTx) {
        throw new ConvexError({
          code: 'EXECUTOR_MERGE_CONFLICT',
          message: 'Оба аккаунта — исполнители с историей. Объединение выполняет администратор.',
        })
      }
    }

    // Self-order: an order whose customer and executor would both collapse to S
    // is invalid (you cannot be assigned your own order). Refuse — no safe auto-fix.
    const ids = new Set<Id<'users'>>([S._id, D._id])
    for (const who of [S._id, D._id]) {
      const orders = await ctx.db
        .query('orders')
        .withIndex('by_customer', (q) => q.eq('customerId', who))
        .collect()
      for (const o of orders) {
        if (o.assignedExecutorId && ids.has(o.assignedExecutorId)) {
          throw new ConvexError({
            code: 'SELF_ORDER_CONFLICT',
            message: 'Один человек как заказчик и исполнитель в одной заявке — объедините вручную.',
          })
        }
      }
    }

    // ── domain FK reassignment D → S ────────────────────────────────────────
    const dCustomerOrders = await ctx.db
      .query('orders')
      .withIndex('by_customer', (q) => q.eq('customerId', D._id))
      .collect()
    for (const o of dCustomerOrders) await ctx.db.patch(o._id, { customerId: S._id })

    const dExecutorOrders = await ctx.db
      .query('orders')
      .withIndex('by_executor', (q) => q.eq('assignedExecutorId', D._id))
      .collect()
    for (const o of dExecutorOrders) await ctx.db.patch(o._id, { assignedExecutorId: S._id })

    // messages.senderId — bounded to orders either identity participates in
    // (a sender only writes on their own orders), so no global scan.
    const touchedOrderIds = new Set<Id<'orders'>>()
    for (const o of dCustomerOrders) touchedOrderIds.add(o._id)
    for (const o of dExecutorOrders) touchedOrderIds.add(o._id)
    for (const o of await ctx.db
      .query('orders')
      .withIndex('by_customer', (q) => q.eq('customerId', S._id))
      .collect())
      touchedOrderIds.add(o._id)
    for (const o of await ctx.db
      .query('orders')
      .withIndex('by_executor', (q) => q.eq('assignedExecutorId', S._id))
      .collect())
      touchedOrderIds.add(o._id)
    for (const oid of touchedOrderIds) {
      const msgs = await ctx.db
        .query('messages')
        .withIndex('by_order', (q) => q.eq('orderId', oid))
        .collect()
      for (const m of msgs) if (m.senderId === D._id) await ctx.db.patch(m._id, { senderId: S._id })
    }

    // categories.createdBy / executorProfiles.reviewedBy / transactions.createdBy
    // — low-volume tables, full scan is fine for a rare merge.
    for (const c of await ctx.db.query('categories').collect()) {
      if (c.createdBy === D._id) await ctx.db.patch(c._id, { createdBy: S._id })
    }
    for (const p of await ctx.db.query('executorProfiles').collect()) {
      if (p.reviewedBy === D._id) await ctx.db.patch(p._id, { reviewedBy: S._id })
    }
    for (const t of await ctx.db.query('transactions').collect()) {
      if (t.createdBy === D._id) await ctx.db.patch(t._id, { createdBy: S._id })
    }

    // orderDrafts singleton — keep the newer, re-point to S, drop the other.
    const dDraft = await ctx.db
      .query('orderDrafts')
      .withIndex('by_user', (q) => q.eq('userId', D._id))
      .unique()
    const sDraft = await ctx.db
      .query('orderDrafts')
      .withIndex('by_user', (q) => q.eq('userId', S._id))
      .unique()
    if (dDraft && sDraft) {
      if (dDraft.updatedAt > sDraft.updatedAt) {
        await ctx.db.delete(sDraft._id)
        await ctx.db.patch(dDraft._id, { userId: S._id })
      } else {
        await ctx.db.delete(dDraft._id)
      }
    } else if (dDraft) {
      await ctx.db.patch(dDraft._id, { userId: S._id })
    }

    // executorProfiles singleton — carry over / collapse to exactly one for S.
    if (dProf && !sProf) {
      await ctx.db.patch(dProf._id, { userId: S._id })
    } else if (dProf && sProf) {
      const keep = pickKeeperProfile(sProf, dProf)
      const drop = keep._id === sProf._id ? dProf : sProf
      for (const t of await ctx.db
        .query('transactions')
        .withIndex('by_executor', (q) => q.eq('executorProfileId', drop._id))
        .collect()) {
        await ctx.db.patch(t._id, { executorProfileId: keep._id })
      }
      const mergedCategories = Array.from(new Set([...keep.categoryIds, ...drop.categoryIds]))
      await ctx.db.patch(keep._id, {
        userId: S._id,
        categoryIds: mergedCategories,
        balance: keep.balance + drop.balance,
        status: keep.status === 'approved' || drop.status === 'approved' ? 'approved' : keep.status,
        updatedAt: Date.now(),
      })
      // Audit breadcrumb when two ledgers were summed (force path only).
      if (drop.balance !== 0) {
        await ctx.db.insert('transactions', {
          executorProfileId: keep._id,
          type: 'accrual',
          amount: 0,
          createdAt: Date.now(),
        })
      }
      await ctx.db.delete(drop._id)
    }

    // ── hard verify: nothing must still point at D before we delete it ──────
    const dangling =
      (await ctx.db
        .query('orders')
        .withIndex('by_customer', (q) => q.eq('customerId', D._id))
        .first()) ??
      (await ctx.db
        .query('orders')
        .withIndex('by_executor', (q) => q.eq('assignedExecutorId', D._id))
        .first()) ??
      (await ctx.db
        .query('executorProfiles')
        .withIndex('by_user', (q) => q.eq('userId', D._id))
        .first()) ??
      (await ctx.db
        .query('orderDrafts')
        .withIndex('by_user', (q) => q.eq('userId', D._id))
        .first())
    if (dangling) {
      throw new ConvexError({ code: 'MERGE_DANGLING', message: 'Остались ссылки на дубликат' })
    }
    // Singleton invariants for the survivor (throws if two rows survived).
    await ctx.db
      .query('executorProfiles')
      .withIndex('by_user', (q) => q.eq('userId', S._id))
      .unique()
    await ctx.db
      .query('orderDrafts')
      .withIndex('by_user', (q) => q.eq('userId', S._id))
      .unique()

    // ── merge survivor scalars + delete duplicate domain row ────────────────
    const survivorTelegramId = S.telegramId || D.telegramId
    await ctx.db.patch(S._id, {
      role: maxRole(S.role, D.role),
      email: S.email ?? D.email,
      telegramId: survivorTelegramId,
      telegramUsername: S.telegramUsername ?? D.telegramUsername,
      name: S.name || D.name,
      image: S.image ?? D.image,
      updatedAt: Date.now(),
    })
    await ctx.db.delete(D._id)

    // ── auth-space reconciliation (better-auth component) ───────────────────
    const sAuthId = S.authUserId
    const dAuthId = D.authUserId
    const sAccounts = await listAuthAccounts(ctx, sAuthId)
    const sKeys = new Set(sAccounts.map((a) => `${a.providerId}:${a.accountId}`))
    for (const acc of await listAuthAccounts(ctx, dAuthId)) {
      const key = `${acc.providerId}:${acc.accountId}`
      if (sKeys.has(key)) {
        // survivor already holds this credential — drop the duplicate's copy
        await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
          input: { model: 'account', where: [{ field: '_id', value: acc._id }] },
        })
      } else {
        await ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: 'account',
            where: [{ field: '_id', value: acc._id }],
            update: { userId: sAuthId },
          },
        })
        sKeys.add(key)
      }
    }
    // drop the duplicate's sessions (paginated; deleteOne(user) does not cascade)
    let scur: string | null = null
    for (;;) {
      const r = (await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model: 'session', where: [{ field: 'userId', value: dAuthId }] },
        paginationOpts: { cursor: scur, numItems: 500 },
      })) as { isDone: boolean; continueCursor: string }
      if (r.isDone) break
      scur = r.continueCursor
    }
    // delete the duplicate auth user row (accounts moved/dropped above)
    await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: { model: 'user', where: [{ field: '_id', value: dAuthId }] },
    })

    // stamp the unified identity onto the survivor's auth user so every sign-in
    // path resolves to S. Order matters: the duplicate is already deleted, so
    // setting its (unique) email on S no longer collides.
    const sAuthUser = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: '_id', value: sAuthId }],
    })) as { telegramId?: string | null; telegramUsername?: string | null; email?: string } | null
    const authUpdate: Record<string, unknown> = {}
    if (survivorTelegramId && !sAuthUser?.telegramId) {
      authUpdate.telegramId = survivorTelegramId
      if (D.telegramUsername && !sAuthUser?.telegramUsername) {
        authUpdate.telegramUsername = D.telegramUsername
      }
    }
    if (D.email && isPlaceholderEmail(sAuthUser?.email)) {
      authUpdate.email = D.email
      authUpdate.emailVerified = true
    }
    if (Object.keys(authUpdate).length > 0) {
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: { model: 'user', where: [{ field: '_id', value: sAuthId }], update: authUpdate },
      })
    }
    // Guarantee a telegram-oidc account on S so web «Войти через Telegram»
    // (findOAuthUser checks the account row first) resolves to S — the miniapp
    // 'telegram' account alone isn't enough.
    if (survivorTelegramId && !sKeys.has(`telegram-oidc:${survivorTelegramId}`)) {
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'account',
          data: {
            userId: sAuthId,
            providerId: 'telegram-oidc',
            accountId: survivorTelegramId,
            telegramId: survivorTelegramId,
          },
        },
      })
    }

    return { status: 'merged' as const, survivorUserId: S._id }
  },
})

// Written by the OAuth-callback account-create guard (auth.ts) when an
// email-born session user tries to link a Telegram already owned by a separate
// (Telegram-born) user. The web client then offers «это мой аккаунт».
export const recordMergeCandidate = internalMutation({
  args: { survivorAuthUserId: v.string(), duplicateTelegramId: v.string() },
  handler: async (ctx, { survivorAuthUserId, duplicateTelegramId }) => {
    const existing = await ctx.db
      .query('mergeCandidates')
      .withIndex('by_survivor', (q) => q.eq('survivorAuthUserId', survivorAuthUserId))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { duplicateTelegramId, createdAt: Date.now() })
    } else {
      await ctx.db.insert('mergeCandidates', {
        survivorAuthUserId,
        duplicateTelegramId,
        createdAt: Date.now(),
      })
    }
  },
})

/**
 * Web «Привязать Telegram» → after the link collides, the user clicks
 * "это мой аккаунт — объединить". Dual control is proven (live email session +
 * the Telegram OAuth they just completed), so merge the Telegram-born duplicate
 * into the email session user.
 */
export const requestSelfMerge = mutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ status: 'merged' | 'already-merged'; survivorUserId: Id<'users'> }> => {
    const S = await getUser(ctx)
    if (!S) throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Требуется вход' })
    const cand = await ctx.db
      .query('mergeCandidates')
      .withIndex('by_survivor', (q) => q.eq('survivorAuthUserId', S.authUserId))
      .first()
    if (!cand || Date.now() - cand.createdAt > CANDIDATE_TTL_MS) {
      if (cand) await ctx.db.delete(cand._id)
      throw new ConvexError({
        code: 'NO_PENDING_MERGE',
        message: 'Нет ожидающего объединения. Начните привязку Telegram заново.',
      })
    }
    const D = await ctx.db
      .query('users')
      .withIndex('by_telegram', (q) => q.eq('telegramId', cand.duplicateTelegramId))
      .first()
    await ctx.db.delete(cand._id)
    if (!D) throw new ConvexError({ code: 'NO_DUPLICATE', message: 'Дубликат не найден' })
    if (D._id === S._id) return { status: 'already-merged' as const, survivorUserId: S._id }
    if (D.role === 'admin' && S.role !== 'admin') {
      throw new ConvexError({
        code: 'ADMIN_MERGE_CONFLICT',
        message: 'Этот Telegram принадлежит администратору — объединение через поддержку.',
      })
    }
    return await ctx.runMutation(internal.merge.mergeUsers, {
      survivorUserId: S._id,
      duplicateUserId: D._id,
    })
  },
})

// Resolve the current session's domain user from an action (auth identity
// propagates through runQuery).
export const sessionDomainUser = internalQuery({
  args: {},
  handler: async (ctx) => await getUser(ctx),
})

export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) =>
    await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
      .first(),
})

export const storeMergeOtp = internalMutation({
  args: {
    survivorAuthUserId: v.string(),
    duplicateUserId: v.id('users'),
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('mergeEmailOtps')
      .withIndex('by_survivor', (q) => q.eq('survivorAuthUserId', args.survivorAuthUserId))
      .first()
    if (existing && existing.expiresAt > now) {
      // An active code already exists for this session. Enforce the resend
      // cooldown and the cumulative-attempt lockout server-side, and carry the
      // budget forward so a resend can't reset it. Throwing here means
      // requestEmailMerge sends nothing (it swallows these → still {ok:true}).
      if (now - existing.lastSentAt < MERGE_OTP_RESEND_MS) {
        throw new ConvexError({ code: 'MERGE_COOLDOWN', message: 'Код уже отправлен — подождите.' })
      }
      if (existing.cumulativeAttempts >= MAX_CUMULATIVE_OTP_ATTEMPTS) {
        throw new ConvexError({ code: 'TOO_MANY_ATTEMPTS', message: 'Слишком много попыток.' })
      }
      await ctx.db.patch(existing._id, {
        duplicateUserId: args.duplicateUserId,
        email: args.email,
        code: args.code,
        attempts: 0,
        lastSentAt: now,
        expiresAt: now + OTP_TTL_MS,
      })
      return
    }
    if (existing) await ctx.db.delete(existing._id) // expired → fresh budget
    await ctx.db.insert('mergeEmailOtps', {
      ...args,
      attempts: 0,
      cumulativeAttempts: 0,
      lastSentAt: now,
      expiresAt: now + OTP_TTL_MS,
    })
  },
})

export const consumeMergeOtp = internalMutation({
  args: { survivorAuthUserId: v.string(), otp: v.string() },
  handler: async (ctx, { survivorAuthUserId, otp }) => {
    const row = await ctx.db
      .query('mergeEmailOtps')
      .withIndex('by_survivor', (q) => q.eq('survivorAuthUserId', survivorAuthUserId))
      .first()
    if (!row)
      throw new ConvexError({ code: 'INVALID_OTP', message: 'Код не найден. Запросите новый.' })
    if (Date.now() > row.expiresAt) {
      await ctx.db.delete(row._id)
      throw new ConvexError({ code: 'OTP_EXPIRED', message: 'Код истёк. Запросите новый.' })
    }
    // Lock once either the per-code or the cumulative budget is spent. Do NOT
    // delete the row — keeping it (until expiry) is what blocks a resend from
    // minting a fresh budget (storeMergeOtp sees an active locked row).
    if (row.attempts >= MAX_OTP_ATTEMPTS || row.cumulativeAttempts >= MAX_CUMULATIVE_OTP_ATTEMPTS) {
      throw new ConvexError({
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Слишком много попыток. Попробуйте позже.',
      })
    }
    if (row.code !== otp.trim()) {
      await ctx.db.patch(row._id, {
        attempts: row.attempts + 1,
        cumulativeAttempts: row.cumulativeAttempts + 1,
      })
      throw new ConvexError({ code: 'INVALID_OTP', message: 'Неверный код.' })
    }
    const duplicateUserId = row.duplicateUserId
    await ctx.db.delete(row._id)
    return { duplicateUserId }
  },
})

/**
 * TMA/web «Привязать почту» onto an email already owned by another account.
 * Sends a 6-digit code to that email; entering it proves the Telegram session
 * user also controls the email inbox → the two profiles can merge. Always
 * returns ok (anti-enumeration: never reveals whether the email exists).
 */
export const requestEmailMerge = action({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{ ok: true }> => {
    const normEmail = email.trim().toLowerCase()
    const S = await ctx.runQuery(internal.merge.sessionDomainUser, {})
    if (!S) throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Требуется вход' })
    const D = await ctx.runQuery(internal.merge.findUserByEmail, { email: normEmail })
    // Nothing to merge, same account, or would touch an admin → silently no-op.
    if (!D || D._id === S._id || (D.role === 'admin' && S.role !== 'admin')) return { ok: true }
    // Math.random is allowed in Convex actions (not mutations) and is fine for
    // a single-use, short-TTL, attempt-limited code (not a long-term secret).
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
    // storeMergeOtp throws on the resend cooldown or the cumulative-attempt
    // lockout. Swallow those and send nothing — this both bounds the email-bomb
    // (≤1 send per cooldown per session) and keeps the response uniform
    // (anti-enumeration: always {ok:true}, regardless of target/limit state).
    try {
      await ctx.runMutation(internal.merge.storeMergeOtp, {
        survivorAuthUserId: S.authUserId,
        duplicateUserId: D._id,
        email: normEmail,
        code,
      })
    } catch {
      return { ok: true }
    }
    await sendEmail({
      to: normEmail,
      subject: 'Объединение аккаунтов — Налоговый помощник',
      text: `Ваш код для объединения аккаунтов: ${code}\n\nВы запросили привязку этой почты к аккаунту Telegram. Введите код в приложении. Код действует 10 минут. Если вы не запрашивали объединение — проигнорируйте письмо.`,
    })
    return { ok: true }
  },
})

export const confirmEmailMerge = action({
  args: { otp: v.string() },
  handler: async (
    ctx,
    { otp },
  ): Promise<{ status: 'merged' | 'already-merged'; survivorUserId: Id<'users'> }> => {
    const S = await ctx.runQuery(internal.merge.sessionDomainUser, {})
    if (!S) throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Требуется вход' })
    const { duplicateUserId } = await ctx.runMutation(internal.merge.consumeMergeOtp, {
      survivorAuthUserId: S.authUserId,
      otp,
    })
    return await ctx.runMutation(internal.merge.mergeUsers, {
      survivorUserId: S._id,
      duplicateUserId,
    })
  },
})

/** Admin escape hatch — the only path past the money-safety gate (`force`). */
export const adminMerge = mutation({
  args: {
    survivorUserId: v.id('users'),
    duplicateUserId: v.id('users'),
    force: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ status: 'merged' | 'already-merged'; survivorUserId: Id<'users'> }> => {
    await requireAdmin(ctx)
    return await ctx.runMutation(internal.merge.mergeUsers, args)
  },
})
