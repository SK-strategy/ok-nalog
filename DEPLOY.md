# Deploying tax-assistant to a VPS (oknalog.net)

End-to-end bootstrap for a fresh VPS. Run top to bottom on the first deploy; later deploys only need
step 8 (push images, restart containers).

The stack: Caddy (TLS) → Next.js apps + Convex self-hosted backend + Postgres. Five public
hostnames, all on `45.145.13.114`.

| Hostname                      | Container                      | What it serves                             |
| ----------------------------- | ------------------------------ | ------------------------------------------ |
| `oknalog.net` (+ `www` → 301) | `web`                          | Public site                                |
| `admin.oknalog.net`           | `admin`                        | Admin app                                  |
| `tma.oknalog.net`             | `tma`                          | Telegram Mini App                          |
| `api.oknalog.net`             | `convex-backend` :3210 + :3211 | Convex Cloud + Site (path-routed in Caddy) |
| `convex.admin.oknalog.net`    | `convex-dashboard`             | Self-hosted dashboard (basic auth)         |

---

## Three layers of env vars

Mixing them up is the most common way to break a self-hosted Convex deploy.

- **Layer A — container env**: lives in `/opt/tax-assistant/.env` on the VPS. Loaded by
  docker-compose at startup. See `.env.prod.example`.
- **Layer B — Convex _deployment_ env**: stored inside Postgres. Set via
  `npx convex env set <KEY> <VALUE>` from your laptop, pointed at the prod backend. Read by Convex
  functions at runtime (e.g. `process.env.JWKS`).
- **Layer C — local-only env**: your laptop's `.env.prod` (gitignored). Used to run `convex deploy`
  against the prod backend.

The `CONVEX_SELF_HOSTED_ADMIN_KEY` appears in both A and C — it's the same value. Layer A has it so
the dashboard container can verify logins; layer C has it so `convex deploy` from your laptop is
authenticated.

---

## Prerequisites

- VPS reachable at `45.145.13.114`. Root SSH initially; will switch to key-only.
- DNS for `oknalog.net` under your control. Six A records required: `@`, `www`, `admin`, `tma`,
  `api`, `convex.admin` — all → `45.145.13.114`.
- GitHub PAT with `write:packages` (laptop, for `docker push`) and a second PAT with `read:packages`
  (VPS, for `docker pull`).
- BotFather bot token. OIDC client_id/secret are optional at first boot — Mini App + Login Widget
  keep working without them.

---

## Step 1 — Build + push images (your laptop)

```bash
# One-time setup
echo "<your write-packages PAT>" | docker login ghcr.io -u netosha --password-stdin
docker buildx create --use --name tax-assistant-builder || true

# Build all three (linux/amd64 since the VPS is amd64)
SHA=$(git rev-parse --short HEAD)
for app in web admin tma; do
  docker buildx build \
    --platform linux/amd64 \
    -f apps/$app/Dockerfile \
    -t ghcr.io/netosha/tax-assistant-$app:$SHA \
    -t ghcr.io/netosha/tax-assistant-$app:latest \
    --push \
    .
done
```

The three Dockerfiles build the same way: `turbo prune` → `pnpm install` →
`turbo build --filter=@tax-assistant/<app>` → copy standalone bundle to runner. No env vars are
baked in; the same image runs in any environment.

---

## Step 2 — Provision the VPS

SSH in as root once, then drop a deploy user + lock down access.

```bash
ssh root@45.145.13.114

# Install Docker + Compose v2 from Ubuntu's own repos. Do NOT use Docker's
# download.docker.com repo on a brand-new Ubuntu release — it lags new codenames
# by weeks, so the apt line 404s on e.g. `resolute` (26.04). Ubuntu's docker.io +
# docker-compose-v2 are current enough to run this stack.
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
apt update && apt install -y docker.io docker-compose-v2 ufw openssl
systemctl enable --now docker
docker --version && docker compose version   # sanity: both must print

# Swap — this stack runs ~7 containers; on a 1-2 GB box it OOM-kills without it.
# Skip if the VPS already has >= 4 GB RAM.
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf && sysctl --system >/dev/null

# Firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp        # HTTP/3
ufw --force enable

# Deploy user (no sudo needed for docker — runs as a docker-group member)
adduser --disabled-password --gecos '' deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
# Paste your laptop's public key into /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Optional but recommended: lock root SSH
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

Now switch to the deploy user for everything that follows:

```bash
ssh deploy@45.145.13.114
```

Authenticate the VPS Docker to GHCR so it can pull private images:

```bash
echo "<your read-packages PAT>" | docker login ghcr.io -u netosha --password-stdin
```

---

## Step 3 — Drop config files onto the VPS

```bash
# On VPS:
sudo mkdir -p /opt/tax-assistant && sudo chown deploy:deploy /opt/tax-assistant
cd /opt/tax-assistant

# From your laptop (rsync the three files):
rsync deploy@45.145.13.114:/dev/null /dev/null  # warm SSH
rsync docker-compose.prod.yml Caddyfile.prod .env.prod.example \
      deploy@45.145.13.114:/opt/tax-assistant/

# Back on VPS:
cd /opt/tax-assistant
cp .env.prod.example .env
# Fill in:
#   POSTGRES_PASSWORD     openssl rand -hex 24
#   INSTANCE_SECRET       openssl rand -hex 32
#   DASHBOARD_BCRYPT      docker run --rm caddy:2-alpine caddy hash-password --plaintext '<chosen pw>'
# Leave CONVEX_SELF_HOSTED_ADMIN_KEY blank for now.
nano .env
```

---

## Step 4 — First boot, generate the admin key

DNS must already resolve to the VPS before this step — Caddy needs port 80 to mint LE certs. Check
with `dig +short api.oknalog.net` from your laptop.

```bash
# Bring up just the backend trio (apps will fail without env yet).
docker compose -f docker-compose.prod.yml up -d postgres convex-backend caddy
docker compose -f docker-compose.prod.yml logs -f caddy   # watch LE issue certs

# Once convex-backend is healthy, generate the deterministic admin key.
docker compose -f docker-compose.prod.yml exec convex-backend ./generate_admin_key.sh
# Copy the output (looks like: tax_assistant|014d2b1e19de…)
# Paste it into /opt/tax-assistant/.env as CONVEX_SELF_HOSTED_ADMIN_KEY.

# Also drop it into your LAPTOP's .env.prod for `convex deploy`:
#   CONVEX_SELF_HOSTED_URL=https://api.oknalog.net
#   CONVEX_SELF_HOSTED_ADMIN_KEY=<same value>

# Restart backend so the dashboard picks up the admin key. (Dashboard reads
# admin key only via login form, but restarting also confirms the .env edit
# took effect.)
docker compose -f docker-compose.prod.yml up -d convex-dashboard
```

---

## Step 5 — JWKS bootstrap (chicken-and-egg)

better-auth signs session JWTs with an RS256 keypair stored in the `betterAuth.jwks` table.
`auth.config.ts` reads it from `process.env.JWKS` to skip the runtime JWKS-over-HTTPS fetch (which
would fail behind a self-signed proxy chain in some deploys).

`convex deploy` rejects pushes when `getAuthConfigProvider({ jwks: undefined })` can't validate the
auth config — but the `jwks:generate` action that _would_ populate JWKS lives in the source we're
pushing. The unblock is a placeholder:

```bash
# From your LAPTOP, with .env.prod set up:
cd backend/convex

# 1. Placeholder JWKS so the first push doesn't reject the auth config.
pnpm with-prod-env npx convex env set JWKS '[]'

# 2. First deploy. Pushes schema + functions, including jwks:generate.
pnpm with-prod-env npx convex deploy

# 3. Generating the REAL JWKS is DEFERRED to the end of Step 6. jwks:generate
#    builds the better-auth instance, and current better-auth hard-throws
#    "You are using the default secret" when BETTER_AUTH_SECRET isn't set —
#    which it isn't yet. Set the deployment env (Step 6) first; the generate
#    command lives at the bottom of Step 6.
```

Once the real JWKS is set (end of Step 6), both `convex()` (signing side) and
`getAuthConfigProvider()` (verification side) share the same keypair as a static document.

---

## Step 6 — Set the rest of the Convex deployment env

Still from your laptop, still in `backend/convex/`:

```bash
pnpm with-prod-env npx convex env set BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
pnpm with-prod-env npx convex env set TELEGRAM_BOT_TOKEN <from BotFather>
pnpm with-prod-env npx convex env set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME Oknalog_net_bot

pnpm with-prod-env npx convex env set WEB_ORIGIN   https://oknalog.net
pnpm with-prod-env npx convex env set ADMIN_ORIGIN https://admin.oknalog.net
pnpm with-prod-env npx convex env set TMA_ORIGIN   https://tma.oknalog.net

# Only if you've done the BotFather OIDC ritual:
pnpm with-prod-env npx convex env set TELEGRAM_OIDC_CLIENT_ID     <from BotFather>
pnpm with-prod-env npx convex env set TELEGRAM_OIDC_CLIENT_SECRET <from BotFather>

# Email OTP login (Resend). Without the key, codes are printed to the Convex
# function log instead of being emailed. The default onboarding@resend.dev
# sender only reaches the Resend account owner's address — verify oknalog.net
# at resend.com/domains and set RESEND_FROM to go live for real users.
pnpm with-prod-env npx convex env set RESEND_API_KEY <from resend.com>
pnpm with-prod-env npx convex env set RESEND_FROM "Налоговый помощник <auth@oknalog.net>"

# Notification bot (apps/bot). Authenticates the worker against the /bot/*
# HTTP actions. The SAME value must also be in /opt/tax-assistant/.env on the
# VPS (layer A) or the two won't agree. Missing here = the routes fail shut and
# nothing is ever delivered.
pnpm with-prod-env npx convex env set BOT_SERVICE_SECRET "$(openssl rand -hex 32)"

# Now that BETTER_AUTH_SECRET is set, generate the REAL JWKS (deferred from
# Step 5). Use `pnpm exec` on the generate side, NOT `pnpm with-prod-env`:
# `pnpm run`'s "> @tax-assistant/convex@ …" banner prints to STDOUT and would
# poison the piped value. `pnpm exec` emits no banner; 2>/dev/null drops convex's
# stderr, leaving only the JSON keypair on stdout.
pnpm exec dotenv -e ../../.env.prod -- convex run jwks:generate --no-push 2>/dev/null \
  | pnpm with-prod-env npx convex env set JWKS

# Sanity check: list everything that's set (JWKS included).
pnpm with-prod-env npx convex env list
```

---

## Step 7 — Seed the catalogue

```bash
pnpm with-prod-env npx convex run seed:run
```

This loads the `clientType → category → tag` hierarchy used by drafts. Idempotent.

---

## Step 8 — Bring up the apps

Back on the VPS:

```bash
cd /opt/tax-assistant
docker compose -f docker-compose.prod.yml pull web admin tma bot
docker compose -f docker-compose.prod.yml up -d web admin tma bot

# Smoke test
curl -sS -o /dev/null -w '%{http_code}\n' https://oknalog.net
curl -sS -o /dev/null -w '%{http_code}\n' https://admin.oknalog.net
curl -sS -o /dev/null -w '%{http_code}\n' https://tma.oknalog.net
curl -sS https://api.oknalog.net/version             # Convex Cloud
curl -sS https://api.oknalog.net/.well-known/openid-configuration  # Site path
```

All four should return 200. The `.well-known` curl should return a JSON OIDC discovery document —
that confirms Caddy's path-routing is sending site paths to :3211 and not :3210.

The `bot` service has no HTTP surface (it's outbound-only), so curl can't see it. Check its log
instead — the line only prints after it authenticates with Telegram:

```bash
docker compose -f docker-compose.prod.yml logs bot | grep 'authenticated as'
```

> **Never run more than one `bot` replica.** Telegram allows a single long-polling consumer per
> token; a second one makes both flap with `409 Conflict` and updates get split between them. The
> same applies to running `pnpm -F @tax-assistant/bot dev` on your laptop while prod is up.

---

## Step 9 — BotFather updates

In `@BotFather`:

1. `/setdomain` for the bot → enter `oknalog.net`
2. `/newapp` or edit the existing Mini App → URL = `https://tma.oknalog.net`
3. If you have OIDC enabled, set Redirect URL =
   `https://api.oknalog.net/api/auth/callback/telegram-oidc`

---

## Step 10 — End-to-end smoke test

1. Open `tma.oknalog.net` inside Telegram — `signInWithMiniApp` runs silently; you land
   authenticated.
2. Open `oknalog.net` → click "Войти через Telegram" — OIDC redirect to oauth.telegram.org → back to
   `api.oknalog.net/api/auth/callback/telegram-oidc` → back to `oknalog.net?ott=…` → session lit up.
3. Open `admin.oknalog.net` — same OIDC flow. Promote your user to `admin` by editing `users.role`
   in the Convex dashboard.

---

## Subsequent deploys

One command from the repo root (wraps the manual steps below):

```bash
pnpm deploy:prod                       # build+push images, convex deploy, VPS restart, smoke test
pnpm deploy:prod -- web                # only the web image (+ convex + restart)
pnpm deploy:prod -- --skip-convex      # images only
pnpm deploy:prod -- --skip-images      # convex functions only
pnpm deploy:prod -- --direct           # no GHCR: docker save | ssh docker load
```

`scripts/deploy.sh` expects `.env.prod` at the repo root (layer C — see above) for the convex-deploy
step, SSH access as `deploy@45.145.13.114`, and a GHCR-authenticated docker (skip with
`--direct`). It also rsyncs `docker-compose.prod.yml` + `Caddyfile.prod` to the VPS on every run;
the VPS `.env` is never touched.

Manually, the same loop is:

```bash
# 1. Laptop: build + push new image tag.
SHA=$(git rev-parse --short HEAD)
for app in web admin tma; do
  docker buildx build --platform linux/amd64 \
    -f apps/$app/Dockerfile \
    -t ghcr.io/netosha/tax-assistant-$app:$SHA \
    -t ghcr.io/netosha/tax-assistant-$app:latest \
    --push .
done

# 2. (Optional) push convex functions if backend code changed.
cd backend/convex && pnpm with-prod-env npx convex deploy

# 3. VPS: pull + restart.
ssh deploy@45.145.13.114 'cd /opt/tax-assistant \
  && docker compose -f docker-compose.prod.yml pull web admin tma \
  && docker compose -f docker-compose.prod.yml up -d web admin tma'
```

To change a URL (e.g. you migrate domains), just edit `CONVEX_URL` and `CONVEX_SITE_URL` in
`/opt/tax-assistant/.env` and run `docker compose -f docker-compose.prod.yml up -d web admin tma` —
no rebuild.

---

## Troubleshooting

**Caddy can't get certs.** Check that all six A records resolve to the VPS, and that ports 80 + 443
are open in UFW. `docker compose logs caddy` will show the LE ACME challenge result.

**"unable_to_get_user_info" in OIDC callback.** Telegram returns HTTP 200 +
`{"error":"invalid_grant"}` body for OIDC token failures (instead of 400). This usually means the
`TELEGRAM_OIDC_CLIENT_SECRET` is wrong or the BotFather Redirect URL doesn't match
`https://api.oknalog.net/api/auth/callback/telegram-oidc` character-for-character.

**`account_not_linked` + "No session found".** `accountLinking.requireLocalEmailVerified` defaults
to true. The Convex auth code already sets it to false (Telegram emails are synthetic
`@telegram.local` and never verified) — but verify your push contains that line.

**WebSocket sync stuck connecting.** Make sure Caddy didn't accidentally route `/api/sync` to the
site server. The Caddyfile only matches `/api/auth*` and `/.well-known/*` for the site; `/api/sync`
falls through to `convex-backend:3210` which is what handles WebSocket upgrades.

**Dashboard 401 loop.** Caddy basic auth: the bcrypt hash in `.env` must have single `$` (not
escaped). docker-compose substitutes `${VAR}` then Caddy substitutes `{$VAR}` from its own env —
both work, but `$$` in compose `.env` becomes a literal `$$` (two characters) and bcrypt
verification fails.
