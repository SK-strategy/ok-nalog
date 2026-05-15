# AGENTS.md

Conventions for humans and AI agents working in this repository. Read this
before editing code.

## Project overview

`fedor` is a Turborepo + pnpm monorepo. One Next.js app today, designed to
grow. All workspace packages share the `@fedor/*` scope.

```
apps/
  web/               # Main Next.js application (FSD inside)
backend/
  convex/            # @fedor/convex — Convex backend (schema + functions)
packages/
  components/        # @fedor/components — branded compositions on top of @fedor/ui (event-calendar, …)
  ui/                # @fedor/ui — shadcn-based primitives
  validators/        # Shared Zod schemas
tooling/
  eslint/            # @fedor/eslint-config (flat config)
  prettier/          # @fedor/prettier-config
  tailwind/          # @fedor/tailwind-config (CSS-first Tailwind v4)
  typescript/        # @fedor/tsconfig (base + compiled-package)
  github/            # CI workflows
turbo/               # turbo generators (used by `pnpm ui-add`, etc.)
```

## Tech stack

- **Runtime**: Node ≥ 22.21, pnpm ≥ 10.19
- **App framework**: Next.js 16 (App Router) + React 19
- **Backend**: Convex (self-hosted, Postgres-backed) via `@fedor/convex`
- **Styling**: Tailwind CSS v4 (CSS-first, theme via `@fedor/tailwind-config`)
- **Validation**: Zod 4
- **Quality**: ESLint 9 (flat config) + Prettier 3 + Steiger (FSD linter)
- **Type system**: TypeScript 5.9 (strict)

## Architecture — Feature-Sliced Design (FSD)

The Next.js app is organised by FSD. Steiger enforces this; see
[`steiger.config.ts`](./steiger.config.ts) and
[feature-sliced.design](https://feature-sliced.design).

### Layers (top → bottom, can only import downwards)

| Layer        | Purpose                                            | Lives in                          |
|--------------|----------------------------------------------------|-----------------------------------|
| `app/`       | Next.js routing + global providers/styles          | `apps/web/src/app/`            |
| `views/`     | Page-level compositions (consumed by route files)  | `apps/web/src/views/`          |
| `widgets/`   | Independent UI blocks (header, sidebar, …)         | `apps/web/src/widgets/`        |
| `features/`  | User-interaction units (`auth/login`, …)           | `apps/web/src/features/`       |
| `entities/`  | Business entities (`user`, `post`, …)              | `apps/web/src/entities/`       |
| `shared/`    | Reusable code with no domain knowledge             | `apps/web/src/shared/`         |

The Next.js `app/` directory doubles as FSD's `app` layer. Keep route files
(`page.tsx`, `layout.tsx`) thin — they should mostly re-export from `views/`.

### Slice and segment structure

Each layer except `app/` and `shared/` is **slice-based**:

```
features/auth/
  ui/        # React components
  model/     # state, hooks, selectors
  api/       # feature-specific server calls   (optional)
  lib/       # feature-private helpers          (optional)
  index.ts   # public API — only file consumers may import
```

`shared/` is **segment-based**: `shared/ui`, `shared/lib`, `shared/api`,
`shared/config`. Each segment exposes a public API via its own `index.ts`.

### Import rules (enforced by Steiger)

1. **Layer direction**: a layer may only import from layers **below** it.
   `widgets` can import `features`, `entities`, `shared`. Never the reverse.
2. **No lateral imports**: a slice cannot import another slice on the same
   layer. If `features/auth` needs `features/post`, the shared dependency
   moves down to `entities/` or `shared/`.
3. **Public-API only**: never reach into another slice's internals.
   ✅ `import { LoginForm } from '~/features/auth'`
   ❌ `import { LoginForm } from '~/features/auth/ui/login-form'`

### Where do I put new code?

Start at the bottom and escalate:

1. **No business meaning?** → `shared/{ui,lib,api,config}/…`
2. **Represents a domain noun?** → `entities/<noun>/`
3. **Drives a user action?** → `features/<verb>/`
4. **Composed UI block reused on multiple pages?** → `widgets/<name>/`
5. **A full page's content?** → `views/<name>/`, then re-export from
   `app/<route>/page.tsx`.

## Coding conventions

- **No semicolons**, single quotes, trailing commas, printWidth 100. Prettier
  is the source of truth — `pnpm lint:fix` autoformats via
  `eslint-plugin-prettier`.
- **Type imports**: always `import type` for type-only symbols
  (`@typescript-eslint/consistent-type-imports`).
- **No `process.env` reads** in app code — go through `~/env` (validated by
  `@t3-oss/env-nextjs` + Zod).
- **Filenames**: `kebab-case.ts(x)`. Components named in `PascalCase` inside
  the file. Hooks named `useX`.
- **Path alias**: `~/*` resolves to `apps/web/src/*`.

## Commands

| Command              | What it does                                            |
|----------------------|---------------------------------------------------------|
| `pnpm dev`           | Start all dev tasks (Turbo watch)                       |
| `pnpm dev:next`      | Just the Next.js app                                    |
| `pnpm build`         | Build everything                                        |
| `pnpm lint`          | ESLint on every workspace                               |
| `pnpm lint:fix`      | ESLint --fix (also formats via Prettier integration)    |
| `pnpm lint:fsd`      | Steiger — FSD architectural rules                       |
| `pnpm lint:ws`       | sherif — workspace hygiene (dep alignment, etc.)        |
| `pnpm format`        | Prettier --check                                        |
| `pnpm format:fix`    | Prettier --write                                        |
| `pnpm typecheck`     | `tsc --noEmit` on every workspace                       |
| `pnpm check`         | `lint` + `lint:fsd` + `format` + `typecheck`            |
| `pnpm clean`         | Remove root `node_modules`                              |
| `pnpm clean:workspaces` | Run each workspace's `clean` script                  |

## Tooling notes

### Prettier plugins (in order)

1. `@ianvs/prettier-plugin-sort-imports` — groups imports per layer.
2. `prettier-plugin-packagejson` — sorts / normalises `package.json`.
3. `prettier-plugin-tailwindcss` — sorts Tailwind class strings.
4. `prettier-plugin-classnames` — wraps long class strings to `printWidth`.
5. `prettier-plugin-merge` — **must be last**; allows the others to coexist.

`cn`, `cva`, `cx`, `tw`, `clsx` are all recognised as Tailwind class
builders by both the sort and wrap plugins.

### ESLint

- Base: `@fedor/eslint-config/base` (typescript-eslint with type-checking).
- Composed configs: `/nextjs`, `/react`.
- `eslint-plugin-prettier/recommended` is loaded last so `eslint --fix`
  reformats with Prettier and any conflicting stylistic rules are off.

### Steiger (FSD)

Config: [`steiger.config.ts`](./steiger.config.ts) at the repo root.
Loads `@feature-sliced/steiger-plugin`'s recommended ruleset. Run via
`pnpm lint:fsd`.

## Convex (self-hosted) — `@fedor/convex`

Backend lives in `backend/convex/convex/` (schema + functions). The web
app consumes the generated `api` via `import { api } from '@fedor/convex'`.

### One-time setup

1. Copy `.env.example` → `.env` and leave `CONVEX_SELF_HOSTED_ADMIN_KEY`
   empty for now.
2. Bring up Postgres + Convex backend + dashboard:
   ```sh
   docker compose up -d
   ```
3. Grab the admin key and paste it into `.env`:
   ```sh
   docker compose exec convex-backend ./generate_admin_key.sh
   ```
4. Push the schema and functions to your local backend:
   ```sh
   pnpm -F @fedor/convex dev
   ```
   This regenerates `backend/convex/convex/_generated/` from your schema
   and watches for changes. Keep it running alongside `pnpm dev`.

### Endpoints

| Service          | URL                       |
|------------------|---------------------------|
| Backend API      | `http://127.0.0.1:3210`   |
| HTTP actions     | `http://127.0.0.1:3211`   |
| Dashboard        | `http://127.0.0.1:6791`   |
| Postgres         | `postgres://fedor:fedor@127.0.0.1:5432/fedor` |

### Adding a function

1. Edit/create a module under `backend/convex/convex/` (e.g.
   `posts.ts`).
2. Export `query`/`mutation`/`action` from `./_generated/server`.
3. `pnpm -F @fedor/convex dev` (or codegen) regenerates the typed
   `api` re-export — consumers get autocomplete immediately.

### `_generated/` files

Committed to git so the workspace type-checks before anyone runs
`convex dev`. They are overwritten on every codegen, so don't hand-edit.

## Component structure (in `@fedor/components`)

`@fedor/components` is for **composed, multi-part components** — each lives
in its own directory under `src/`, with sub-components, hooks, types, and
constants colocated. Pattern (see `src/event-calendar/` as the reference):

```
src/<component-name>/
├── <component-name>/          # the root piece (e.g. calendar/)
│   ├── <component-name>.tsx   # component implementation
│   └── index.ts               # re-export {Component, Props, Context, …}
├── <sub-part>/                # repeat for each sub-component
│   ├── <sub-part>.tsx
│   └── index.ts
├── hooks/                     # hooks that drive the component family
│   └── use-*.ts
├── types.ts                   # shared types across sub-components
├── constants.ts               # tunables (spacing, defaults, …)
└── index.ts                   # public API barrel (the only file consumers import)
```

Rules:

- **One barrel per slice.** Consumers import from `@fedor/components/<name>`
  or `@fedor/components`. Never reach into a sub-directory.
- **Sub-components are siblings, not children of the root file.** This
  keeps each piece reviewable in isolation and lets `useContext` flow
  through the root.
- **Hooks belong inside the slice** when they're tied to its lifecycle
  (e.g. `useCalendarGrid`). Genuinely cross-cutting hooks belong in
  `apps/web/src/shared/lib/` instead.
- **`'use client'` lives at the leaf** — files that call React hooks.
  RSC-safe sub-components can omit it.

For one-off / single-file components (a `Badge`, a `Spinner`) the flat
shape `src/<name>.tsx` + a barrel entry is fine — escalate to the folder
pattern as soon as a second file appears.

## Adding a new workspace package

1. `mkdir -p packages/<name>/src` and add `package.json` with
   `"name": "@fedor/<name>"`, `"type": "module"`, the relevant scripts,
   and the appropriate `@fedor/{eslint-config,prettier-config,tsconfig}` dev
   deps.
2. Add `"prettier": "@fedor/prettier-config"` to the manifest.
3. Add a `tsconfig.json` extending `@fedor/tsconfig/base.json` (apps) or
   `compiled-package.json` (libraries that emit types).
4. Create `eslint.config.ts` exporting `defineConfig(baseConfig)` (plus
   `reactConfig`/`nextjsConfig`/`restrictEnvAccess` as needed).
5. `pnpm install` to wire workspace links.

`pnpm lint:ws` (sherif) will fail postinstall if dep versions drift across
workspaces or if `package.json` keys aren't alphabetised.

## CI / quality gates

Before merging, ensure `pnpm check` is green. That single command covers
ESLint, Steiger, Prettier, and TypeScript across every workspace.
