import type { AuthFunctions, GenericCtx, Triggers } from '@convex-dev/better-auth'
import type { BetterAuthOptions } from 'better-auth'
import { createClient } from '@convex-dev/better-auth'
import { convex, crossDomain } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { telegram } from 'better-auth-telegram'
import { bearer } from 'better-auth/plugins'

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

const adminTelegramIds = (): Set<string> =>
  new Set(
    (process.env.TELEGRAM_ADMIN_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )

// Trigger callbacks run in the app's mutation context (with access to the
// domain `ctx.db`), fired by the betterAuth component after it writes to its
// own `user` table. Keep them idempotent — they retry on partial failures.
const triggers: Triggers<DataModel, typeof schema> = {
  user: {
    onCreate: async (ctx, doc) => {
      const telegramId = doc.telegramId ?? ''
      const role = adminTelegramIds().has(telegramId) ? 'admin' : 'customer'
      const now = Date.now()
      const existing = await ctx.db
        .query('users')
        .withIndex('by_auth_user', (q) => q.eq('authUserId', doc._id))
        .unique()
      if (existing) return // already mirrored — defensive against retries
      await ctx.db.insert('users', {
        authUserId: doc._id,
        telegramId,
        telegramUsername: doc.telegramUsername ?? undefined,
        name: doc.name,
        image: doc.image ?? undefined,
        role,
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
        updatedAt: number
      }> = {}
      if (newDoc.name !== oldDoc.name) patch.name = newDoc.name
      if (newDoc.image !== oldDoc.image) patch.image = newDoc.image ?? undefined
      if (newDoc.telegramUsername !== oldDoc.telegramUsername) {
        patch.telegramUsername = newDoc.telegramUsername ?? undefined
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
    baseURL: process.env.CONVEX_SITE_ORIGIN,
    trustedOrigins: [
      process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3100',
      process.env.ADMIN_ORIGIN ?? 'http://127.0.0.1:3101',
      process.env.TMA_ORIGIN ?? 'http://127.0.0.1:3102',
    ],
    secret: env('BETTER_AUTH_SECRET'),
    database: authComponent.adapter(ctx),
    plugins: [
      telegram({
        botToken,
        botUsername,
        miniApp: {
          enabled: true,
          validateInitData: true,
          allowAutoSignin: true,
          // Telegram doesn't provide email — synthesise a placeholder so
          // better-auth's required-email schema is satisfied.
          mapMiniAppDataToUser: (u) => ({
            name: u.last_name ? `${u.first_name} ${u.last_name}` : u.first_name,
            image: u.photo_url,
            email: `${u.id}@telegram.miniapp`,
            emailVerified: false,
          }),
        },
        mapTelegramDataToUser: (u) => ({
          name: u.last_name ? `${u.first_name} ${u.last_name}` : u.first_name,
          image: u.photo_url,
          email: `${u.id}@telegram.widget`,
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
              },
            }
          : {}),
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
