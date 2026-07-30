import { defineConfig } from 'eslint/config'

import { baseConfig, restrictEnvAccess } from '@tax-assistant/eslint-config/base'

export default defineConfig(
  {
    ignores: ['dist/**'],
  },
  baseConfig,
  restrictEnvAccess,
)
