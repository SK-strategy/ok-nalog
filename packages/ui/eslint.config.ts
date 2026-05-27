import { defineConfig } from 'eslint/config'

import { baseConfig } from '@tax-assistant/eslint-config/base'
import { reactConfig } from '@tax-assistant/eslint-config/react'

export default defineConfig(
  {
    ignores: ['dist/**'],
  },
  baseConfig,
  reactConfig,
  {
    // shadcn-generated components don't conform to our strict type-checked
    // rules — they use `any` in prop pass-through, declare empty interfaces
    // for forwardRef, and have many always-truthy default-prop checks.
    // Relax those rules here so generated code lints clean. App code (which
    // doesn't extend this config) keeps the full strictness.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      'react/display-name': 'off',
      'react/prop-types': 'off',
    },
  },
)
