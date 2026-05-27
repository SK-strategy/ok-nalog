import type { AuthConfig } from 'convex/server'
import { getAuthConfigProvider } from '@convex-dev/better-auth/auth-config'

// Tells Convex how to validate JWTs minted by better-auth's `convex()` plugin.
// `jwks` is passed as a static document (from `pnpm with-env npx convex run
// jwks:dump | … env set JWKS`) so Convex doesn't try to fetch the JWKS over
// HTTPS — that fails from inside the Docker container because the mkcert dev
// cert isn't in the container's trust store. With a static JWKS, signing and
// verification both work without any network hop.
export default {
  providers: [getAuthConfigProvider({ jwks: process.env.JWKS })],
} satisfies AuthConfig
