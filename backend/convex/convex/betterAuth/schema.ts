import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Local Install schema for the better-auth Convex component. Adds the telegram
// plugin's user/account fields (telegramId, telegramUsername,
// telegramPhoneNumber) which the bundled component doesn't know about.
// Better-auth refers to these tables by their hardcoded names ("user",
// "session", "account", "verification", ...) — don't rename.
//
// Role + display-side profile data live on the domain `users` table (see
// `convex/schema.ts`), kept in sync via the user triggers in `auth.ts`.
//
// Optional+null pattern (`v.optional(v.union(v.null(), v.X()))`) matches the
// bundled validators so plugin code that sends `null` (vs omitting the key)
// still passes validation.
//
// `schemaValidation: false` is intentional and important:
//   - Push-time validation would reject legacy rows that contain dead fields
//     from removed plugin configs (e.g. a `role` field left over from an old
//     `additionalFields: { role }` setup). That blocks schema deploys until
//     the data is manually scrubbed — a chicken-and-egg we hit twice already.
//   - Runtime write validation is redundant here: `createApi` (which all
//     better-auth-driven writes go through) builds its mutation arg validators
//     from `table.validator.fields`, so writes are still validated at the
//     mutation boundary. The schema's job in this component is to enumerate
//     tables + field types for the adapter, not to police row shapes.
//   - Reads in our code only touch the fields we explicitly named below;
//     stray fields are ignored.

export default defineSchema(
  {
    user: defineTable({
      name: v.string(),
      email: v.string(),
      emailVerified: v.boolean(),
      image: v.optional(v.union(v.null(), v.string())),
      createdAt: v.float64(),
      updatedAt: v.float64(),

      // better-auth-telegram additions
      telegramId: v.optional(v.union(v.null(), v.string())),
      telegramUsername: v.optional(v.union(v.null(), v.string())),
      telegramPhoneNumber: v.optional(v.union(v.null(), v.string())),

      // Standard bundled fields we don't actively use but the component expects.
      userId: v.optional(v.union(v.null(), v.string())),
      twoFactorEnabled: v.optional(v.union(v.null(), v.boolean())),
      isAnonymous: v.optional(v.union(v.null(), v.boolean())),
      username: v.optional(v.union(v.null(), v.string())),
      displayUsername: v.optional(v.union(v.null(), v.string())),
      phoneNumber: v.optional(v.union(v.null(), v.string())),
      phoneNumberVerified: v.optional(v.union(v.null(), v.boolean())),
    })
      .index('email', ['email'])
      .index('telegramId', ['telegramId'])
      .index('userId', ['userId']),

    session: defineTable({
      userId: v.string(),
      token: v.string(),
      expiresAt: v.float64(),
      createdAt: v.float64(),
      updatedAt: v.optional(v.union(v.null(), v.float64())),
      ipAddress: v.optional(v.union(v.null(), v.string())),
      userAgent: v.optional(v.union(v.null(), v.string())),
    })
      .index('token', ['token'])
      .index('userId', ['userId']),

    account: defineTable({
      userId: v.string(),
      accountId: v.string(),
      providerId: v.string(),
      accessToken: v.optional(v.union(v.null(), v.string())),
      refreshToken: v.optional(v.union(v.null(), v.string())),
      idToken: v.optional(v.union(v.null(), v.string())),
      accessTokenExpiresAt: v.optional(v.union(v.null(), v.float64())),
      refreshTokenExpiresAt: v.optional(v.union(v.null(), v.float64())),
      scope: v.optional(v.union(v.null(), v.string())),
      password: v.optional(v.union(v.null(), v.string())),
      // Plugin's Mini App account-create path omits both createdAt and updatedAt;
      // better-auth core only auto-stamps timestamps on `user` for some adapters.
      // Keep both optional so the validator doesn't reject those creates — sign-in
      // would otherwise silently fail right after the user row is written.
      createdAt: v.optional(v.union(v.null(), v.float64())),
      updatedAt: v.optional(v.union(v.null(), v.float64())),

      // better-auth-telegram additions on account
      telegramId: v.optional(v.union(v.null(), v.string())),
      telegramUsername: v.optional(v.union(v.null(), v.string())),
    })
      .index('userId', ['userId'])
      .index('accountId_providerId', ['accountId', 'providerId']),

    verification: defineTable({
      identifier: v.string(),
      value: v.string(),
      expiresAt: v.float64(),
      createdAt: v.float64(),
      updatedAt: v.optional(v.union(v.null(), v.float64())),
    }).index('identifier', ['identifier']),

    jwks: defineTable({
      publicKey: v.string(),
      privateKey: v.string(),
      createdAt: v.float64(),
      expiresAt: v.optional(v.union(v.null(), v.float64())),
    }),

    rateLimit: defineTable({
      key: v.string(),
      count: v.float64(),
      lastRequest: v.float64(),
    }).index('key', ['key']),
  },
  { schemaValidation: false },
)
