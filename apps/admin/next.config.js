import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import('./src/env')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import("next").NextConfig} */
const config = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    '@tax-assistant/components',
    '@tax-assistant/convex',
    '@tax-assistant/ui',
    '@tax-assistant/validators',
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
}

/**
 * Sentry wraps the build to upload source maps and instrument the server.
 *
 * Everything here degrades to a plain Next build when Sentry isn't configured:
 * without SENTRY_AUTH_TOKEN there's no upload step, and without a DSN the
 * runtime SDK never initialises (see src/instrumentation.ts).
 */
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Source maps are uploaded then deleted from the output, so the standalone
  // image doesn't ship readable sources.
  sourcemaps: { deleteSourcemapsAfterUpload: true },

  // Don't let a Sentry outage or a missing token fail a deploy.
  silent: true,
  errorHandler: (err) => {
    console.warn('[sentry] build-time upload skipped:', err.message)
  },
})
