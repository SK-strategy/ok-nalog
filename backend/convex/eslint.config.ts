import { defineConfig } from 'eslint/config'

import { baseConfig } from '@fedor/eslint-config/base'

export default defineConfig(
  {
    // Convex generates these files at build/dev time — don't lint them.
    ignores: ['convex/_generated/**'],
  },
  baseConfig,
  {
    // Convex functions are written in a sandboxed JS runtime. Some of our
    // strict type-checked rules are noisy here (db.query returns are union
    // types, args helpers use overloads). Relax the most common offenders.
    files: ['convex/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
)
