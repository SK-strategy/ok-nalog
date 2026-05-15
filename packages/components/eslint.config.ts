import { defineConfig } from 'eslint/config'

import { baseConfig } from '@fedor/eslint-config/base'
import { reactConfig } from '@fedor/eslint-config/react'

export default defineConfig(
  {
    ignores: ['dist/**'],
  },
  baseConfig,
  reactConfig,
)
