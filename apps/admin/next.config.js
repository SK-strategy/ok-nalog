import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

export default config
