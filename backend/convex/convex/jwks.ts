import { internalAction } from './_generated/server'
import { createAuth } from './auth'

// Generates (rotating any existing) the RS256 keypair that better-auth's
// `convex()` plugin signs JWTs with, and returns it as a JSON string ready
// to be piped straight into the JWKS env var:
//
//   pnpm with-env npx convex run jwks:generate --no-push 2>/dev/null \
//     | pnpm with-env npx convex env set JWKS
//
// Setting JWKS makes both `convex({ jwks })` (signing side) and
// `getAuthConfigProvider({ jwks })` (verification side) skip the runtime
// JWKS-over-HTTPS fetch — that fetch fails from inside the convex-backend
// container because the mkcert dev cert isn't in its trust store.
//
// Bootstrap (no sign-in required):
//   1. `pnpm with-env npx convex env set JWKS '[]'` — placeholder so the
//      convex dev push doesn't reject the auth config.
//   2. `pnpm -F @tax-assistant/convex dev --once` — pushes this action.
//   3. Run the pipe above — generate writes a new key into the betterAuth
//      `jwks` table and returns it. `convex env set` overwrites the
//      placeholder with the real value.
// `rotateKeys` is exposed on `auth.api` at runtime but excluded from
// `InferAPI` because the endpoint is marked SERVER_ONLY. Shim the type so we
// can call it without `any`.
interface JwksKey {
  id: string
  publicKey: string
  privateKey: string
  createdAt: number | Date
  alg: string
}

interface RotateKeysApi {
  rotateKeys: () => Promise<JwksKey[]>
}

export const generate = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx)
    const api = auth.api as unknown as RotateKeysApi
    return await api.rotateKeys()
  },
})
