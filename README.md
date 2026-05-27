# tax-assistant

Tax-consultation marketplace. Customers ask tax questions by category, an admin reviews and prices
every order and assigns a vetted executor (expert), who answers via an anonymised chat and earns a
70% share into a balance.

Three Next.js apps share one Convex backend:

| App          | Audience                        | Auth flow             |
| ------------ | ------------------------------- | --------------------- |
| `apps/web`   | Marketing + customer + executor | Telegram Login Widget |
| `apps/admin` | Admin dashboard                 | Telegram Login Widget |
| `apps/tma`   | Telegram MiniApp                | Telegram initData     |

Conventions and architecture (FSD, eslint, prettier, Steiger) live in [`AGENTS.md`](./AGENTS.md).
Read it before touching code.

## Prerequisites

- Node `^22.21.0`, pnpm `^10.19.0` (see `package.json#engines`)
- Docker + Docker Compose
- A Telegram bot (BotFather) — token

## First-time setup

### 1. Install + env file

```sh
pnpm install
cp .env.example .env
```

Fill `.env` with the values from your Telegram bot and pick a `BETTER_AUTH_SECRET`
(`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
`CONVEX_SELF_HOSTED_ADMIN_KEY` stays empty for now.

### 2. Bring up Postgres + Convex backend

```sh
docker compose up -d
```

Services:

| Service          | URL                                                                   |
| ---------------- | --------------------------------------------------------------------- |
| Convex backend   | `http://127.0.0.1:3310` (HTTPS via Caddy: `:3320`)                    |
| Convex HTTP      | `http://127.0.0.1:3311` (HTTPS via Caddy: `:3321`)                    |
| Convex dashboard | `http://127.0.0.1:6891`                                               |
| Postgres         | `postgres://tax_assistant:tax_assistant@127.0.0.1:5532/tax_assistant` |

Grab the Convex admin key and paste it into `.env` as `CONVEX_SELF_HOSTED_ADMIN_KEY`:

```sh
docker compose exec convex-backend ./generate_admin_key.sh
```

### 3. Mirror server-side secrets to the Convex deployment

The Convex runtime has its own env store separate from your host `.env`. Any var read inside a
Convex function (`backend/convex/convex/**`) must be set on the deployment too. Minimum set for
auth:

```sh
cd backend/convex
for k in BETTER_AUTH_SECRET TELEGRAM_BOT_TOKEN \
         NEXT_PUBLIC_TELEGRAM_BOT_USERNAME \
         WEB_ORIGIN ADMIN_ORIGIN TMA_ORIGIN \
         TELEGRAM_OIDC_CLIENT_ID TELEGRAM_OIDC_CLIENT_SECRET; do
  v="$(grep "^$k=" ../../.env | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
  [ -n "$v" ] && pnpm with-env npx convex env set "$k" "$v"
done
```

`WEB_ORIGIN` / `ADMIN_ORIGIN` / `TMA_ORIGIN` are what better-auth uses for CORS preflight + trusted
callback origins. They must match the origin the browser actually loads each app from (LAN IP if
you're testing TMA on a real phone, `127.0.0.1` otherwise).

Verify with `pnpm with-env npx convex env list`.

### 4. Seed the JWKS env var

`backend/convex/convex/auth.config.ts` reads `process.env.JWKS` so Convex can verify JWTs minted by
better-auth's `convex()` plugin against a static JSON Web Key Set. Without it, Convex would try to
fetch the JWKS over HTTPS at runtime — which fails from inside the convex-backend container because
the mkcert dev cert isn't in the container's trust store. Pinning JWKS as a static value skips the
network hop.

Chicken-and-egg: the Convex CLI rejects the auth config when `JWKS` isn't set, so you can't push
code to generate the key. Bootstrap in three steps:

```sh
cd backend/convex

# (a) Placeholder so the auth-config check passes and the push succeeds.
pnpm with-env npx convex env set JWKS '[]'

# (b) Push the schema + functions (including `convex/jwks.ts`).
pnpm with-env npx convex dev --once --typecheck=disable

# (c) Generate a fresh RS256 keypair and pipe it into the env var.
#     `jwks:generate` calls `auth.api.rotateKeys()` — no sign-in required.
pnpm --silent exec npx convex run jwks:generate --no-push 2>/dev/null \
  | pnpm --silent exec npx convex env set JWKS
```

After (c), `pnpm with-env npx convex dev` should run with no warnings.

> The JWKS env var holds the **private** key. Don't commit it. To rotate, re-run step (c) — note
> that rotating invalidates any active sessions.

### 5. Run the dev stack

```sh
# From the repo root — runs every app + the Convex watcher.
pnpm dev

# Or just one workspace:
pnpm dev:web                           # Next.js (web)
pnpm -F @tax-assistant/convex dev      # Convex watcher
```

## Daily workflow

| Command                             | What it does                                           |
| ----------------------------------- | ------------------------------------------------------ |
| `pnpm dev`                          | All apps + Convex watcher (Turbo)                      |
| `pnpm check`                        | `lint` + `lint:fsd` + `format` + `typecheck` (CI gate) |
| `pnpm lint:fix`                     | ESLint --fix (also runs Prettier)                      |
| `pnpm format:fix`                   | Prettier --write                                       |
| `pnpm -F @tax-assistant/convex dev` | Convex code watcher / re-push on change                |

Full command and convention reference: [`AGENTS.md`](./AGENTS.md).

## Troubleshooting

- **`Environment variable JWKS is used in auth config file but its value was not set.`** — finish
  step 4 above. Step (a) unblocks the push; step (c) replaces the placeholder.
- **`Uncaught BetterAuthError: You are using the default secret.`** — `BETTER_AUTH_SECRET` is set in
  `.env` but not on the Convex deployment. Re-run step 3.
- **CORS: `Origin … is not allowed by Access-Control-Allow-Origin`** — the origin you're loading the
  app from isn't in better-auth's `trustedOrigins`. Set `WEB_ORIGIN` / `ADMIN_ORIGIN` / `TMA_ORIGIN`
  on the deployment to the exact scheme+host+port the browser uses (re-run step 3).
- **`[better-auth] Base URL could not be determined.`** — Convex's `CONVEX_SITE_URL` isn't reaching
  the function runtime. Make sure `docker compose up -d` finished cleanly so `CONVEX_SITE_ORIGIN` is
  set on `convex-backend`.
- **Convex can't reach Postgres** — the `convex-backend` container talks to `postgres:5432` over the
  docker network, not your host. Check `docker compose ps` shows `postgres` healthy.
