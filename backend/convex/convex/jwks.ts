import { components } from './_generated/api'
import { internalAction } from './_generated/server'

// One-shot helper: outputs the current better-auth JWKS records as a JSON
// string so it can be piped into the JWKS env var:
//
//   pnpm with-env npx convex run jwks:dump --no-push 2>/dev/null \
//     | pnpm with-env npx convex env set JWKS
//
// Setting JWKS makes both `convex({ jwks })` (signing side) and
// `getAuthConfigProvider({ jwks })` (verification side) avoid the runtime
// JWKS-over-HTTPS fetch that fails from inside the Docker container when the
// mkcert dev cert isn't trusted there.
export const dump = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: 'jwks',
      paginationOpts: { numItems: 100, cursor: null },
    })
    const rows = (result as { page: Record<string, unknown>[] }).page
    return JSON.stringify(
      rows.map((r) => ({
        id: r._id,
        // Explicit alg avoids `createPublicJwks` falling back to "EdDSA";
        // the convex plugin signs with RS256.
        alg: 'RS256',
        publicKey: r.publicKey,
        privateKey: r.privateKey,
        createdAt: r.createdAt,
      })),
    )
  },
})
