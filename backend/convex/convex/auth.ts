import type { AuthFunctions, GenericCtx, Triggers } from '@convex-dev/better-auth'
import type { BetterAuthOptions } from 'better-auth'
import { createClient } from '@convex-dev/better-auth'
import { convex, crossDomain } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { telegram } from 'better-auth-telegram'
import { bearer, emailOTP } from 'better-auth/plugins'

import type { DataModel } from './_generated/dataModel'
import { components, internal } from './_generated/api'
import authConfig from './auth.config'
import schema from './betterAuth/schema'

// Single better-auth identity surface for all three apps. Telegram plugin
// exposes three flows:
//   - OIDC redirect via oauth.telegram.org  (web, admin)
//   - Mini App initData                     (tma)
//   - Login Widget (HMAC)                   (kept enabled in schema for
//                                            fallback / migration paths)
// OIDC requires a one-time BotFather ritual that produces a Client Secret
// distinct from the bot token — see .env.example.
//
// We use the @convex-dev/better-auth "Local Install" path because the telegram
// plugin adds non-standard fields (telegramId, telegramUsername,
// telegramPhoneNumber on user/account) that the bundled component's hardcoded
// validators reject. The local component (./betterAuth/) owns those tables;
// Convex regenerates validators from our schema.
//
// Mirror flow: a row in the betterAuth component's `user` table is the
// authentication identity. A row in the domain `users` table is the
// application identity (role, profile snapshot). The `triggers` config below
// keeps them in sync — every component create/update/delete fans out to the
// matching domain mutation. The result is that every authenticated user is
// immediately visible in the main Convex dashboard at `users`, and domain
// tables can reference them via `Id<'users'>`.

// Don't throw on missing env at module-load time — `createApi` evaluates this
// during Convex's analyze phase, before env vars are available. Missing values
// at runtime will fail loudly via better-auth's own validation.
const env = (key: string): string => process.env[key] ?? ''

// Telegram-only identities carry a synthetic `${telegramId}@telegram.local`
// email (see mapMiniAppDataToUser below). A "real" email is anything else —
// either set at email sign-up or linked via the TMA change-email flow.
const isPlaceholderEmail = (email: string) => email.endsWith('@telegram.local')

// OTP delivery via Resend (plain fetch — runs inside better-auth's HTTP
// action, where fetch is available; no SDK needed). Without RESEND_API_KEY
// the code is logged instead so the dev loop works without a mail account.
// NB: better-auth wraps this in runInBackgroundOrAwait, which catches and
// logs any throw — the client still receives `success: true` (deliberate
// anti-enumeration). So the throw below is for the function log, not the
// user; the sign-in/link UIs carry a «код не приходит» hint for this case.
// Until a domain is verified in Resend, the default onboarding@resend.dev
// sender can only reach the Resend account owner's own address.
const OTP_EMAIL_COPY: Record<
  'sign-in' | 'email-verification' | 'forget-password' | 'change-email',
  { subject: string; intro: string }
> = {
  'sign-in': {
    subject: 'Код для входа — Налоговый помощник',
    intro: 'Ваш код для входа:',
  },
  'email-verification': {
    subject: 'Подтверждение почты — Налоговый помощник',
    intro: 'Ваш код подтверждения почты:',
  },
  'forget-password': {
    subject: 'Сброс пароля — Налоговый помощник',
    intro: 'Ваш код для сброса пароля:',
  },
  'change-email': {
    subject: 'Привязка почты — Налоговый помощник',
    intro: 'Ваш код для привязки почты к аккаунту:',
  },
}

const sendOtpEmail = async ({
  email,
  otp,
  type,
}: {
  email: string
  otp: string
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email'
}) => {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'Налоговый помощник <onboarding@resend.dev>'
  const { subject, intro } = OTP_EMAIL_COPY[type]
  if (!apiKey) {
    console.log(`[email-otp] RESEND_API_KEY is not set — ${type} code for ${email}: ${otp}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text: `${intro} ${otp}\n\nКод действует 10 минут. Если вы не запрашивали его — просто проигнорируйте это письмо.`,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(
      `[email-otp] Resend rejected the ${type} email to ${email}: ${res.status} ${body}`,
    )
    throw new Error(`Failed to send OTP email (${res.status})`)
  }
}

// Trigger callbacks run in the app's mutation context (with access to the
// domain `ctx.db`), fired by the betterAuth component after it writes to its
// own `user` table. Keep them idempotent — they retry on partial failures.
const triggers: Triggers<DataModel, typeof schema> = {
  user: {
    onCreate: async (ctx, doc) => {
      const telegramId = doc.telegramId ?? ''
      const now = Date.now()

      // Re-link instead of duplicating: if a domain user with this Telegram id
      // already exists (from a previous sign-in via a different flow, or an
      // older better-auth row), point it at the new authUserId and keep the
      // role/profile state. The domain user is keyed by telegramId — the
      // person, not the auth identity.
      if (telegramId) {
        const byTelegram = await ctx.db
          .query('users')
          .withIndex('by_telegram', (q) => q.eq('telegramId', telegramId))
          .first()
        if (byTelegram) {
          await ctx.db.patch(byTelegram._id, {
            authUserId: doc._id,
            telegramUsername: doc.telegramUsername ?? byTelegram.telegramUsername,
            name: doc.name || byTelegram.name,
            image: doc.image ?? byTelegram.image,
            email: isPlaceholderEmail(doc.email) ? byTelegram.email : doc.email,
            updatedAt: now,
          })
          return
        }
      }

      const existing = await ctx.db
        .query('users')
        .withIndex('by_auth_user', (q) => q.eq('authUserId', doc._id))
        .unique()
      if (existing) return // already mirrored — defensive against retries

      // New domain user — always starts as 'customer'. Promote to 'admin' or
      // 'executor' by editing the `users.role` field directly in the Convex
      // dashboard (or via an admin-only mutation once one exists).
      await ctx.db.insert('users', {
        authUserId: doc._id,
        telegramId,
        telegramUsername: doc.telegramUsername ?? undefined,
        name: doc.name,
        image: doc.image ?? undefined,
        email: isPlaceholderEmail(doc.email) ? undefined : doc.email,
        role: 'customer',
        createdAt: now,
        updatedAt: now,
      })
    },
    onUpdate: async (ctx, newDoc, oldDoc) => {
      const existing = await ctx.db
        .query('users')
        .withIndex('by_auth_user', (q) => q.eq('authUserId', newDoc._id))
        .unique()
      if (!existing) return
      const patch: Partial<{
        name: string
        image: string | undefined
        telegramUsername: string | undefined
        telegramId: string
        email: string | undefined
        updatedAt: number
      }> = {}
      if (newDoc.name !== oldDoc.name) patch.name = newDoc.name
      if (newDoc.image !== oldDoc.image) patch.image = newDoc.image ?? undefined
      if (newDoc.telegramUsername !== oldDoc.telegramUsername) {
        patch.telegramUsername = newDoc.telegramUsername ?? undefined
      }
      if (newDoc.email !== oldDoc.email) {
        // The TMA link flow swaps the placeholder for a verified real email.
        patch.email = isPlaceholderEmail(newDoc.email) ? undefined : newDoc.email
      }
      // Web «Привязать Telegram» stamps telegramId onto an email-born user
      // (account.create.after hook). Mirror it so the domain identity keying
      // and the admin UI follow. Never cleared — unlink isn't exposed.
      if (newDoc.telegramId !== oldDoc.telegramId && newDoc.telegramId) {
        patch.telegramId = newDoc.telegramId
      }
      if (Object.keys(patch).length === 0) return
      patch.updatedAt = Date.now()
      await ctx.db.patch(existing._id, patch)
    },
    onDelete: async (ctx, doc) => {
      const existing = await ctx.db
        .query('users')
        .withIndex('by_auth_user', (q) => q.eq('authUserId', doc._id))
        .unique()
      if (existing) await ctx.db.delete(existing._id)
    },
  },
}

const authFunctions: AuthFunctions = {
  onCreate: internal.auth.onCreate,
  onUpdate: internal.auth.onUpdate,
  onDelete: internal.auth.onDelete,
}

export const authComponent = createClient<DataModel, typeof schema>(components.betterAuth, {
  local: { schema },
  triggers,
  authFunctions,
})

// Registered as internal mutations so the component's CRUD layer can call back
// into us. The actual work happens in the `triggers` callbacks above; these
// thin wrappers route by `args.model`.
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

// Split out so the local adapter (betterAuth/adapter.ts) can call createApi
// with the same options the runtime uses.
export const createAuthOptions = (ctx: GenericCtx<DataModel>): BetterAuthOptions => {
  // Placeholders keep the analyze phase (no env) happy. At runtime the real
  // values come from `npx convex env set …`.
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? 'placeholder-bot-token'
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'placeholder_bot'
  const oidcClientSecret = process.env.TELEGRAM_OIDC_CLIENT_SECRET

  return {
    // CONVEX_SITE_URL is auto-injected by the Convex runtime (it tracks the
    // backend's CONVEX_SITE_ORIGIN config). Using it directly avoids having
    // to mirror the same value into a manually-set deployment env var.
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins: [
      process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3100',
      process.env.ADMIN_ORIGIN ?? 'http://127.0.0.1:3101',
      process.env.TMA_ORIGIN ?? 'http://127.0.0.1:3102',
    ],
    secret: env('BETTER_AUTH_SECRET'),
    database: authComponent.adapter(ctx),
    // Account linking lets better-auth attach a second provider (e.g. OIDC) to
    // an existing user when the email matches. Combined with the unified
    // `@telegram.local` email below, this is what keeps the same Telegram
    // person from getting two better-auth user rows when they sign in through
    // a different flow. trustedProviders bypasses the incoming-provider
    // emailVerified gate (Telegram never verifies the placeholder email).
    //
    // `requireLocalEmailVerified: false` is the matching gate on the EXISTING
    // user's record — better-auth defaults it to `true`, and rejects the link
    // when the dbUser's emailVerified flag is false. Since every Telegram
    // sign-in stamps emailVerified=false (placeholder `@telegram.local`), the
    // default refuses to link a fresh OIDC sign-in onto a user previously
    // created via Mini App / Login Widget — surfacing as "account not linked"
    // in the OAuth callback and "No session found" from the crossDomain
    // after-hook (which sees no session to one-time-token). Disabling it is
    // safe here: the synthetic email is derived from the Telegram id, so the
    // only party who can "register" `${id}@telegram.local` is the holder of
    // that id, which is precisely what we're authenticating.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['telegram', 'telegram-oidc'],
        requireLocalEmailVerified: false,
        // Explicit linking (web «Привязать Telegram» → linkSocial with the
        // telegram-oidc provider) compares the provider email against the
        // session user's email and rejects on mismatch by default. Telegram's
        // synthetic `${id}@telegram.local` never equals a real email, so the
        // check must be off. Safe: linking requires an authenticated session
        // AND completing Telegram's own OAuth — both identities are proven.
        allowDifferentEmails: true,
      },
    },
    // better-auth only rate-limits when NODE_ENV is production unless told
    // otherwise; force it on so the OTP endpoints (3 req/min per IP, from the
    // emailOTP plugin's own rules) are protected in every deployment. Counters
    // live in the component's `rateLimit` table — in-memory storage would be
    // per-isolate and effectively off on Convex.
    rateLimit: {
      enabled: true,
      storage: 'database',
    },
    databaseHooks: {
      user: {
        update: {
          // A Telegram-born user who links a real email stops matching the
          // `${telegramId}@telegram.local` lookup that the OIDC callback uses
          // to attach to the existing user (account row match is tried first,
          // email second — see better-auth's findOAuthUser). Without help,
          // their *first* web "Войти через Telegram" after linking would
          // create a duplicate auth user. Pre-creating the telegram-oidc
          // account row here pins every future OIDC sign-in to this user.
          // Mini App / Login Widget flows are immune — they resolve via the
          // user.telegramId field, not the email.
          after: async (user, hookCtx) => {
            if (!hookCtx) return
            const u = user as typeof user & { telegramId?: string | null }
            if (!u.telegramId || !u.emailVerified || isPlaceholderEmail(u.email)) return
            const existing = await hookCtx.context.adapter.findOne({
              model: 'account',
              where: [
                { field: 'providerId', value: 'telegram-oidc' },
                { field: 'accountId', value: u.telegramId },
              ],
            })
            if (existing) return
            // createdAt/updatedAt omitted on purpose — mirrors the telegram
            // plugin's own account creates, which our schema already allows.
            await hookCtx.context.adapter.create({
              model: 'account',
              data: {
                userId: u.id,
                providerId: 'telegram-oidc',
                accountId: u.telegramId,
                telegramId: u.telegramId,
              },
            })
          },
        },
      },
      account: {
        create: {
          // One Telegram identity must map to exactly one auth user — the
          // whole flow architecture (miniapp lookup by user.telegramId,
          // domain dedup by telegramId) depends on it. If an email-first
          // user already opened the TMA, auto-signin minted a separate
          // telegram-born user; letting them ALSO link that Telegram to the
          // email account via OIDC would cross-wire the identity (miniapp →
          // user B, OIDC → user A). Refuse the raw link.
          //
          // But this collision IS the "same human, two accounts" case the
          // merge tooling exists for. Before refusing, drop a merge candidate
          // (the email session user S + the Telegram id D just OAuth-proved)
          // so the web client can offer «это мой аккаунт — объединить», which
          // calls merge.requestSelfMerge. `ctx` here is the closure ctx from
          // createAuthOptions — at OAuth-callback time it's the httpAction ctx
          // (has runMutation; registerRoutesLazy threads it). The runMutation
          // commits independently of this hook returning false.
          before: async (account, hookCtx) => {
            if (!hookCtx) return
            const a = account as typeof account & { accountId?: string; providerId?: string }
            if (a.providerId !== 'telegram' && a.providerId !== 'telegram-oidc') return
            if (!a.accountId) return
            const owner = await hookCtx.context.adapter.findOne<{ id: string }>({
              model: 'user',
              where: [{ field: 'telegramId', value: a.accountId }],
            })
            if (owner && owner.id !== a.userId) {
              if ('runMutation' in ctx) {
                await (
                  ctx as unknown as {
                    runMutation: (ref: unknown, args: unknown) => Promise<unknown>
                  }
                ).runMutation(internal.merge.recordMergeCandidate, {
                  survivorAuthUserId: a.userId,
                  duplicateTelegramId: a.accountId,
                })
              }
              return false
            }
          },
          // Explicit OIDC linking creates only the account row — the user
          // keeps telegramId = null, and the Mini App resolves people by
          // that field when no `telegram` account row exists yet. Stamp it
          // here so the TMA picks the linked account up on first open.
          // Going through internalAdapter.updateUser (not the raw adapter)
          // chains into the user.update.after hook above and the domain
          // trigger mirror.
          after: async (account, hookCtx) => {
            if (!hookCtx) return
            const a = account as typeof account & { accountId?: string; providerId?: string }
            if (a.providerId !== 'telegram' && a.providerId !== 'telegram-oidc') return
            if (!a.accountId) return
            const user = await hookCtx.context.adapter.findOne<{
              id: string
              telegramId?: string | null
            }>({
              model: 'user',
              where: [{ field: 'id', value: a.userId }],
            })
            if (!user || user.telegramId) return
            await hookCtx.context.internalAdapter.updateUser(a.userId, {
              telegramId: a.accountId,
            })
          },
        },
      },
    },
    plugins: [
      telegram({
        botToken,
        botUsername,
        miniApp: {
          enabled: true,
          validateInitData: true,
          allowAutoSignin: true,
          // Telegram doesn't provide email — synthesise a stable placeholder
          // keyed by the Telegram user id, shared across all three flows
          // (widget / mini app / OIDC) so account linking can match on it.
          mapMiniAppDataToUser: (u) => ({
            name: u.last_name ? `${u.first_name} ${u.last_name}` : u.first_name,
            image: u.photo_url,
            email: `${u.id}@telegram.local`,
            emailVerified: false,
          }),
        },
        mapTelegramDataToUser: (u) => ({
          name: u.last_name ? `${u.first_name} ${u.last_name}` : u.first_name,
          image: u.photo_url,
          email: `${u.id}@telegram.local`,
          emailVerified: false,
        }),
        // OIDC stays disabled until BotFather setup is done and the client
        // secret lands in env; until then sign-in via OIDC errors at redirect
        // time, while the Mini App flow keeps working.
        ...(oidcClientSecret
          ? {
              oidc: {
                enabled: true,
                clientSecret: oidcClientSecret,
                requestPhone: false,
                // Telegram OIDC ships two id-like claims in the id_token:
                //   - `sub`: a 20-digit pseudonymous per-(bot, user) subject
                //     identifier (e.g. "17505335518239559980"). Stable, but
                //     bears no relation to any other Telegram surface.
                //   - `id`:  the real numeric Telegram user id (e.g.
                //     "246007355"), the same value Login Widget / Mini App /
                //     bot API return. Not in the plugin's `TelegramOIDCClaims`
                //     TS type, but Telegram does send it.
                //
                // We map `id`, `email`, and `telegramId` all off `claims.id`.
                // The `id` override matters because the plugin's getUserInfo
                // uses it as `account.accountId`, which is what better-auth
                // looks up on every subsequent OIDC sign-in. Keying that on
                // the real Telegram id (rather than the pseudonymous `sub`)
                // is what makes all three flows resolve to one user:
                //   - account lookup `(telegram-oidc, 246007355)` matches any
                //     prior OIDC sign-in by the same person
                //   - if no OIDC account row exists yet, accountLinking
                //     attaches it to the user already pinned by the
                //     `${telegramId}@telegram.local` email or by the trigger's
                //     telegramId-based domain re-link
                // Without overriding `id`, the plugin would default to
                // `account.accountId = claims.sub`, which never matches
                // anything the Login Widget / Mini App flows produced.
                mapOIDCProfileToUser: (claims) => {
                  const c = claims as unknown as { id?: unknown; sub?: unknown }
                  const telegramId = String(c.id ?? c.sub ?? '')
                  return {
                    id: telegramId,
                    email: `${telegramId}@telegram.local`,
                    emailVerified: false,
                    telegramId,
                  }
                },
              },
            }
          : {}),
      }),
      // Passwordless email login for web/admin + the TMA "привязать почту"
      // flow. Sign-in: send a 6-digit code, verify, session. Unknown emails
      // sign up as fresh customers (flip `disableSignUp` to restrict email
      // login to already-linked accounts).
      //
      // changeEmail is the linking primitive: requestEmailChange sends the
      // code to the NEW address while the user stays signed in via Telegram,
      // and changeEmail applies `email + emailVerified: true` atomically only
      // after the code checks out (verify-then-change — no window where an
      // unverified foreign email sits on the account). Taken emails are
      // silently accepted at request time (anti-enumeration: no email is
      // sent) and rejected with "Email already in use" at the verify step.
      emailOTP({
        otpLength: 6,
        expiresIn: 600, // matches the «код действует 10 минут» copy above
        allowedAttempts: 5,
        changeEmail: { enabled: true },
        sendVerificationOTP: sendOtpEmail,
      }),
      bearer(),
      // Server side of the cross-domain bridge. Without this, response
      // `Set-Cookie` headers are unreadable by the browser across origins
      // (HTTPS app → HTTPS Convex on different ports). This plugin rewrites
      // them to `Set-Better-Auth-Cookie`, which crossDomainClient grabs and
      // stores in localStorage. Without the pair, sign-in succeeds on the
      // server but `useSession()` never flips to authenticated.
      //
      // `siteUrl` is used as the default callback origin for OAuth/magic-link
      // flows; the cookie-transformation hook runs for ANY request carrying
      // the `Better-Auth-Cookie` header, so all three apps work.
      crossDomain({
        siteUrl: process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3100',
      }),
      convex({ authConfig, jwks: process.env.JWKS }),
    ],
  }
}

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx))
