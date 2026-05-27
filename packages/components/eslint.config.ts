import { defineConfig } from 'eslint/config'

import { baseConfig } from '@tax-assistant/eslint-config/base'
import { reactConfig } from '@tax-assistant/eslint-config/react'

export default defineConfig(
  {
    ignores: ['dist/**'],
  },
  baseConfig,
  reactConfig,
)
