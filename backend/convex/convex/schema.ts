import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Source of truth for the persisted shape. The same string-literal sets are
// mirrored as Zod enums in `@tax-assistant/validators` for app/UI use — keep them in
// sync (ROLES, ORDER_STATUSES, EXECUTOR_STATUSES, CLIENT_TYPES, …). Money is
// integer kopecks.
//
// Identity:
//   - The better-auth Convex component owns the authentication tables
//     (`user`, `session`, `account`, …) inside its own namespace.
//   - The domain `users` table below is a mirror, kept in sync via the
//     `triggers` wiring in `auth.ts`. Every authenticated user has exactly
//     one row here. Domain tables reference it via `Id<'users'>`.

const clientType = v.union(
  v.literal('legal_entity_ie'),
  v.literal('individual'),
  v.literal('npd_payer'),
)

export default defineSchema({
  // ── Domain users (mirror of the better-auth identity + Telegram profile) ──
  users: defineTable({
    authUserId: v.string(),
    telegramId: v.string(),
    telegramUsername: v.optional(v.string()),
    name: v.string(),
    image: v.optional(v.string()),
    // Real (sign-up or TMA-linked) email only — the synthetic
    // `${telegramId}@telegram.local` placeholder is never mirrored here.
    email: v.optional(v.string()),
    role: v.union(v.literal('customer'), v.literal('executor'), v.literal('admin')),
    // Set when Telegram refuses delivery for a reason that won't fix itself —
    // the user blocked the bot, or the account is gone. The notification worker
    // stops targeting them until they /start again (which clears it). Without
    // this every future notification would burn a doomed API call.
    botBlockedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_user', ['authUserId'])
    .index('by_telegram', ['telegramId'])
    .index('by_email', ['email']),

  // ── Account-merge scratch tables ──────────────────────────────────────────
  // One person can accumulate two identities (a Telegram-born auth user from a
  // silent TMA auto-signin AND an email-born one from web sign-up) before ever
  // linking them. Linking then collides, and these short-lived rows carry the
  // "prove dual control → merge" handshake. See `merge.ts`.
  //
  // Web «Привязать Telegram»: the OAuth callback's account-create guard refuses
  // the cross-wire and drops a candidate here (survivor = the email session
  // user, duplicate = the Telegram id just OAuth-proven). `requestSelfMerge`
  // consumes it.
  mergeCandidates: defineTable({
    survivorAuthUserId: v.string(),
    duplicateTelegramId: v.string(),
    createdAt: v.number(),
  }).index('by_survivor', ['survivorAuthUserId']),

  // TMA/web «Привязать почту» onto a taken email: a 6-digit code sent to that
  // email proves the Telegram session user also controls the email account, so
  // the two profiles can merge (survivor = the Telegram session user).
  mergeEmailOtps: defineTable({
    survivorAuthUserId: v.string(),
    duplicateUserId: v.id('users'),
    email: v.string(),
    code: v.string(),
    attempts: v.number(), // failed guesses against the current code
    // Anti-brute-force: failed guesses summed across resends (a resend mints a
    // fresh code but must NOT hand the attacker a fresh budget), and the last
    // send time for a server-side resend cooldown. Without these, the 5-attempt
    // cap resets every resend → a 6-digit code is brute-forceable.
    cumulativeAttempts: v.number(),
    lastSentAt: v.number(),
    expiresAt: v.number(),
  }).index('by_survivor', ['survivorAuthUserId']),

  // ── Catalogue (admin-managed, seedable) ───────────────────────────────────
  // Top-level thematic groupings ("Налоговые проверки", "Основные налоги" …).
  // `code` is the stable seed key used for idempotent upserts.
  // `clientTypes` is the union of client types the category is relevant to —
  // home filters categories by the currently selected client type.
  categories: defineTable({
    code: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    basePrice: v.number(), // примерная стоимость, kopecks
    isActive: v.boolean(),
    sortOrder: v.number(),
    clientTypes: v.optional(v.array(clientType)),
    createdBy: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_active_order', ['isActive', 'sortOrder'])
    .index('by_code', ['code']),

  // ── Tags (specific topics inside a category) ──────────────────────────────
  // The customer picks a tag in the new-question form so the admin and the
  // executor know the precise topic. Routing now flows through the
  // executor's own `categoryIds` selection — no separate specialist code.
  tags: defineTable({
    name: v.string(),
    categoryId: v.id('categories'),
    clientTypes: v.array(clientType),
    sortOrder: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_category', ['categoryId'])
    .index('by_active_category', ['isActive', 'categoryId']),

  // ── Per-user order draft ──────────────────────────────────────────────────
  // One row per user; the new-question form auto-saves into it so the customer
  // can close the TMA mid-question and resume on the next open. Cleared on
  // successful `orders.create`.
  orderDrafts: defineTable({
    userId: v.id('users'),
    categoryId: v.optional(v.id('categories')),
    tagId: v.optional(v.id('tags')),
    clientType: v.optional(clientType),
    description: v.string(),
    attachmentIds: v.array(v.id('_storage')),
    // Mirrors `orders.linkedOrderIds` so a half-composed вопрос keeps its
    // attached history across a TMA restart like everything else in the form.
    linkedOrderIds: v.optional(v.array(v.id('orders'))),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // ── Executors (анкета + balance) ──────────────────────────────────────────
  executorProfiles: defineTable({
    userId: v.id('users'),
    fullName: v.string(),
    // Autogenerated identity-hiding handle («Мудрый Барсук») shown to customers
    // instead of fullName. Assigned once at profile creation; optional for
    // back-compat with profiles predating it (backfilled by executors.backfillNicknames).
    nickname: v.optional(v.string()),
    bio: v.string(),
    qualifications: v.string(),
    categoryIds: v.array(v.id('categories')),
    status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected')),
    balance: v.number(), // kopecks accrued, zeroed on payout
    // Reputation: running sum and count of customers' 1–10 answer ratings.
    // Denormalised (bumped atomically in orders.rateOrder, like `balance`) so
    // the cabinet/admin can show an average without scanning every order.
    // Optional for back-compat with profiles created before ratings existed —
    // read them as 0 via `?? 0`.
    ratingSum: v.optional(v.number()),
    ratingCount: v.optional(v.number()),
    reviewedBy: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    // Approved-executor edits don't go live immediately. They land here as a
    // proposed revision awaiting admin review (executors.apply on an approved
    // profile). executors.reviewChanges merges them into the live fields on
    // approval, or discards them (recording changeRejectionReason) on
    // rejection. The executor stays `approved` and fully operational the whole
    // time — customers keep seeing the live анкета. Only ever one outstanding
    // revision per profile: a fresh edit overwrites the previous pending one.
    pendingChanges: v.optional(
      v.object({
        fullName: v.string(),
        bio: v.string(),
        qualifications: v.string(),
        categoryIds: v.array(v.id('categories')),
        submittedAt: v.number(),
      }),
    ),
    // Admin's comment when the last proposed revision was rejected. Kept until
    // the executor submits a new revision (which clears it).
    changeRejectionReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status']),

  // ── Orders (the order lifecycle) ──────────────────────────────────────────
  // `tagId` and `clientType` are snapshots captured at creation so the order
  // record stays meaningful even if the catalogue is later edited.
  orders: defineTable({
    customerId: v.id('users'),
    categoryId: v.id('categories'),
    tagId: v.optional(v.id('tags')),
    clientType: v.optional(clientType),
    description: v.string(),
    attachmentIds: v.array(v.id('_storage')),
    // Closed заявки the customer attached as background when opening this one
    // ("вот моё прошлое обращение по этой же теме"). The expert assigned here
    // can read those threads read-only via `orders.linkedHistory`, so they
    // don't have to ask the client to re-explain history the platform already
    // has. Always the customer's own, always already-terminal orders — both
    // enforced in `orders.create`.
    linkedOrderIds: v.optional(v.array(v.id('orders'))),
    status: v.union(
      v.literal('submitted'),
      v.literal('rejected'),
      v.literal('priced'),
      v.literal('awaiting_payment'),
      v.literal('payment_expired'),
      v.literal('paid'),
      v.literal('assigned'),
      v.literal('in_progress'),
      v.literal('under_review'),
      v.literal('answered'),
      v.literal('completed'),
      v.literal('rated'),
      v.literal('cancelled'),
    ),
    quotedPrice: v.number(), // snapshot of category.basePrice at creation
    approvedPrice: v.optional(v.number()), // admin-утвердил
    assignedExecutorId: v.optional(v.id('users')),
    rejectionReason: v.optional(v.string()),
    paymentDeadlineAt: v.optional(v.number()), // set = now + PAYMENT_WINDOW_MS on awaiting_payment
    // ── Legacy answer artifact ──────────────────────────────────────────────
    // Historically the executor's deliverable was a single formal answer. The
    // flow is now conversation-based: the executor works the chat and submits
    // the whole dialog for review (orders.submitForReview). These fields are
    // retained only for orders created under the old model and are no longer
    // written; the moderator reviews the conversation itself.
    answerBody: v.optional(v.string()),
    answerAttachmentIds: v.optional(v.array(v.id('_storage'))),
    // ── Customer's 1–10 answer rating (final, optional lifecycle stage) ──────
    rating: v.optional(v.number()),
    ratedAt: v.optional(v.number()),
    createdAt: v.number(),
    submittedAt: v.optional(v.number()),
    pricedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    assignedAt: v.optional(v.number()),
    answeredAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()), // executor submitted the dialog for review
    completedAt: v.optional(v.number()),
  })
    .index('by_customer', ['customerId'])
    .index('by_executor', ['assignedExecutorId'])
    .index('by_status', ['status'])
    .index('by_status_deadline', ['status', 'paymentDeadlineAt'])
    .index('by_category', ['categoryId']),

  // ── Anonymized per-order chat ─────────────────────────────────────────────
  messages: defineTable({
    orderId: v.id('orders'),
    senderRole: v.union(v.literal('customer'), v.literal('executor'), v.literal('system')),
    senderId: v.optional(v.id('users')), // absent for system messages
    body: v.string(),
    attachmentIds: v.array(v.id('_storage')),
    // Who may read this line. `all` (or absent, for rows predating the field)
    // is the whole thread; `staff` is the internal back-channel — moderation
    // notes and admin audit entries that are written INTO the order thread so
    // the executor sees them in context, but which the заказчик must never
    // read. Enforced at the read boundary in `messages.list`, not in the UI:
    // the customer's client never receives a staff line at all.
    audience: v.optional(v.union(v.literal('all'), v.literal('staff'))),
    createdAt: v.number(),
  }).index('by_order', ['orderId', 'createdAt']),

  // ── Money ─────────────────────────────────────────────────────────────────
  payments: defineTable({
    orderId: v.id('orders'),
    amount: v.number(), // kopecks
    status: v.union(
      v.literal('pending'),
      v.literal('succeeded'),
      v.literal('expired'),
      v.literal('failed'),
    ),
    provider: v.string(),
    providerPaymentId: v.optional(v.string()),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
  })
    .index('by_order', ['orderId'])
    .index('by_provider_payment', ['providerPaymentId']),

  // ── Telegram notification outbox ──────────────────────────────────────────
  // Convex decides WHAT to notify and records it here; the `apps/bot` worker
  // decides HOW and WHEN to deliver it. The indirection is the point:
  //
  //  - Telegram rate-limits hard (~1 msg/sec/chat) and fails transiently. A
  //    queue with attempts + backoff survives that; a fire-and-forget fetch
  //    inside the mutation would drop notifications on the floor, and worse,
  //    a slow Telegram call would sit inside the write path of `messages.send`.
  //  - The bot process can restart or be down without losing anything — it
  //    picks up whatever is still `pending`.
  //
  // Rows are never addressed to a person by name. `actorRole` is the only
  // thing said about who acted, which keeps notifications inside the same
  // anonymity envelope as the chat itself.
  notifications: defineTable({
    userId: v.id('users'),
    orderId: v.id('orders'),
    kind: v.union(v.literal('order_reply'), v.literal('moderator_note')),
    // Role of whoever triggered this — never an identity, never a nickname.
    actorRole: v.union(v.literal('customer'), v.literal('executor'), v.literal('moderator')),
    // Short, already-truncated excerpt rendered into the Telegram message.
    // Snapshotted at enqueue time so delivery never re-reads the thread.
    preview: v.string(),
    categoryTitle: v.optional(v.string()),
    status: v.union(v.literal('pending'), v.literal('delivered'), v.literal('abandoned')),
    attempts: v.number(),
    // Backoff gate: the worker ignores rows until this passes.
    nextAttemptAt: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    deliveredAt: v.optional(v.number()),
  })
    .index('by_status', ['status', 'nextAttemptAt'])
    // Coalescing: a burst of replies on one order collapses into the single
    // still-undelivered row for that (user, order, kind) instead of queuing a
    // separate ping per message.
    .index('by_target', ['userId', 'orderId', 'kind', 'status']),

  transactions: defineTable({
    executorProfileId: v.id('executorProfiles'),
    orderId: v.optional(v.id('orders')),
    type: v.union(v.literal('accrual'), v.literal('payout')),
    amount: v.number(), // kopecks (signed)
    createdBy: v.optional(v.id('users')), // admin for payout
    createdAt: v.number(),
  })
    .index('by_executor', ['executorProfileId', 'createdAt'])
    .index('by_order', ['orderId']),
})
