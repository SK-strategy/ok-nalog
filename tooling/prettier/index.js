/** @typedef {import("prettier").Config} PrettierConfig */
/** @typedef {import("prettier-plugin-tailwindcss").PluginOptions} TailwindConfig */
/** @typedef {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */

/** @type { PrettierConfig | SortImportsConfig | TailwindConfig } */
const config = {
  semi: false,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  bracketSpacing: true,
  bracketSameLine: false,
  endOfLine: 'lf',
  quoteProps: 'consistent',

  // Plugin order matters. prettier-plugin-merge MUST be last — it lets the
  // other parser-override plugins (sort-imports, tailwindcss, classnames)
  // coexist on the same file. Source: prettier-plugin-merge docs.
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-packagejson',
    'prettier-plugin-tailwindcss',
    'prettier-plugin-classnames',
    'prettier-plugin-merge',
  ],

  // prettier-plugin-tailwindcss: class sorting + class-builder detection.
  // `tailwindStylesheet` is intentionally omitted — the plugin resolves it
  // relative to CWD (not the config file), so a single shared value can't
  // point at the right path across the monorepo. Each app's CSS imports
  // `@fedor/tailwind-config/theme`, which the plugin picks up via
  // auto-detection.
  tailwindFunctions: ['cn', 'cva', 'cx', 'tw', 'clsx'],
  tailwindAttributes: ['className', 'class'],

  // prettier-plugin-classnames: wraps long Tailwind class strings to
  // printWidth so they don't overflow. `absolute-with-indent` keeps
  // wrapped lines aligned to a stable indent level.
  endingPosition: 'absolute-with-indent',
  customFunctions: ['cn', 'cva', 'cx', 'tw', 'clsx'],
  customAttributes: ['className', 'class'],

  // Import order, top-to-bottom:
  //   1. type-only imports (collected at the top)
  //   2. react / next / third-party
  //   3. workspace packages (@fedor/*)
  //   4. FSD layers, top-down (app → views → widgets → features → entities → shared)
  //   5. relative imports
  importOrder: [
    '<TYPES>',
    '^(react/(.*)$)|^(react$)|^(react-native(.*)$)',
    '^(next/(.*)$)|^(next$)',
    '<THIRD_PARTY_MODULES>',
    '',
    '<TYPES>^@fedor',
    '^@fedor/(.*)$',
    '',
    '<TYPES>^~/app',
    '^~/app(/.*)?$',
    '<TYPES>^~/views',
    '^~/views(/.*)?$',
    '<TYPES>^~/widgets',
    '^~/widgets(/.*)?$',
    '<TYPES>^~/features',
    '^~/features(/.*)?$',
    '<TYPES>^~/entities',
    '^~/entities(/.*)?$',
    '<TYPES>^~/shared',
    '^~/shared(/.*)?$',
    '',
    '<TYPES>^[./]',
    '^[../]',
    '^[./]',
  ],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  importOrderTypeScriptVersion: '5.0.0',

  overrides: [
    {
      files: '*.json.hbs',
      options: { parser: 'json' },
    },
    {
      files: '*.ts.hbs',
      options: { parser: 'babel' },
    },
    {
      files: ['*.md', '*.mdx'],
      options: { proseWrap: 'always' },
    },
  ],
}

export default config
