import { defineConfig } from 'eslint/config'

import { baseConfig, restrictEnvAccess } from '@tax-assistant/eslint-config/base'
import { nextjsConfig } from '@tax-assistant/eslint-config/nextjs'
import { reactConfig } from '@tax-assistant/eslint-config/react'

export default defineConfig(
  {
    ignores: ['.next/**'],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
)
