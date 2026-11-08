#!/usr/bin/env bash
# УСТАРЕЛО: скрипт для прежнего сервера программиста (ghcr.io/netosha, laptop-сборка).
# Новый процесс описан в DEPLOY.md (GitHub Actions + deploy/server/*.sh).
# Push local changes to the production VPS. DEPLOY.md covers the one-time
# bootstrap (admin key, JWKS, deployment env); this automates the
# "Subsequent deploys" loop:
#
#   1. docker buildx build + push the app images to GHCR
#      (--direct skips the registry: docker save | ssh docker load)
#   2. rsync docker-compose.prod.yml + Caddyfile.prod to the VPS
#      (the VPS .env is never touched)
#   3. deploy Convex functions — needs .env.prod at the repo root (layer C)
#   4. pull + restart the app containers on the VPS, then smoke-check
#
# Usage:
#   scripts/deploy.sh                  # everything, all four apps
#   scripts/deploy.sh web admin        # only these app images
#   scripts/deploy.sh bot              # just the notification bot
#   scripts/deploy.sh --skip-images    # convex functions + restart only
#   scripts/deploy.sh --skip-convex    # images + restart only
#   scripts/deploy.sh --skip-restart   # build + push only
#   scripts/deploy.sh --direct         # no registry: save/load images over SSH
#
# Overrides via env:
#   DEPLOY_HOST=deploy@62.60.231.38    DEPLOY_DIR=/opt/tax-assistant
#   REGISTRY=ghcr.io/netosha            PLATFORM=linux/amd64

set -euo pipefail
cd "$(dirname "$0")/.."

DEPLOY_HOST="${DEPLOY_HOST:-deploy@62.60.231.38}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/tax-assistant}"
REGISTRY="${REGISTRY:-ghcr.io/netosha}"
PLATFORM="${PLATFORM:-linux/amd64}"
COMPOSE="docker compose -f docker-compose.prod.yml"

skip_images=0 skip_convex=0 skip_restart=0 direct=0
apps=()
for arg in "$@"; do
  case "$arg" in
    --) ;; # pnpm forwards the literal separator — ignore it
    --skip-images) skip_images=1 ;;
    --skip-convex) skip_convex=1 ;;
    --skip-restart) skip_restart=1 ;;
    --direct) direct=1 ;;
    web | admin | tma | bot) apps+=("$arg") ;;
    *)
      echo "unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done
[ ${#apps[@]} -eq 0 ] && apps=(web admin tma bot)

sha="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠ working tree is dirty — images will be tagged $sha but contain uncommitted changes"
fi

# The path to the VPS regularly flaps with the VPN. Rather than dying mid-
# deploy, wait out short outages before every remote step (~6 min budget).
wait_for_host() {
  for i in $(seq 1 24); do
    if ssh -o BatchMode=yes -o ConnectTimeout=8 "$DEPLOY_HOST" true 2>/dev/null; then
      return 0
    fi
    echo "   … $DEPLOY_HOST unreachable (try $i/24) — retrying in 15s (VPN flap?)"
    sleep 15
  done
  echo "✗ $DEPLOY_HOST stayed unreachable — fix the network and re-run with --skip-images" >&2
  exit 1
}

# ── 1. images ────────────────────────────────────────────────────────────────
if [ "$skip_images" -eq 0 ]; then
  if ! docker version >/dev/null 2>&1; then
    echo "✗ docker unavailable. On WSL2 the /usr/bin/docker symlink dangles when" >&2
    echo "  Docker Desktop is stopped — start it. Or ship without rebuilding: --skip-images." >&2
    exit 1
  fi
  if [ "$direct" -eq 1 ]; then output=--load; else output=--push; fi

  # Sentry's browser DSN is compiled into the client bundle, so it has to be
  # supplied at BUILD time — it is the one value that isn't swappable on the
  # VPS. Sourced from .env.prod (layer C) rather than the environment so a
  # deploy from a clean shell still bakes it in; forgetting it doesn't fail the
  # build, it just silently ships apps that never report browser errors.
  build_args=()
  if [ -f .env.prod ]; then
    for var in NEXT_PUBLIC_SENTRY_DSN SENTRY_ORG SENTRY_PROJECT SENTRY_AUTH_TOKEN; do
      # `|| true` is load-bearing: an absent var makes grep exit 1, and under
      # `set -euo pipefail` that aborts the whole deploy before a single line of
      # output — which is exactly how this failed the first time. SENTRY_AUTH_TOKEN
      # is routinely unset (source-map upload is optional), so this must be a
      # non-event.
      value="$(grep -E "^$var=" .env.prod | head -1 | sed -E 's/^[^=]+=//; s/^"(.*)"$/\1/' || true)"
      if [ -n "$value" ]; then build_args+=(--build-arg "$var=$value"); fi
    done
  fi
  if [ ${#build_args[@]} -eq 0 ]; then
    echo "   ⚠ no Sentry build args found in .env.prod — client-side errors won't report"
  fi

  for app in "${apps[@]}"; do
    echo "── building $app ($sha, $PLATFORM, $output)"
    # The bot isn't a Next.js app: its DSN is read at runtime from the VPS .env,
    # so the build args are only meaningful for the three web images.
    app_args=()
    if [ "$app" != "bot" ]; then app_args=("${build_args[@]}"); fi
    docker buildx build \
      --platform "$PLATFORM" \
      -f "apps/$app/Dockerfile" \
      "${app_args[@]}" \
      -t "$REGISTRY/tax-assistant-$app:$sha" \
      -t "$REGISTRY/tax-assistant-$app:latest" \
      "$output" \
      .
  done
  if [ "$direct" -eq 1 ]; then
    images=()
    for app in "${apps[@]}"; do images+=("$REGISTRY/tax-assistant-$app:latest"); done
    echo "── uploading ${#images[@]} image(s) to $DEPLOY_HOST over SSH"
    docker save "${images[@]}" | gzip | ssh "$DEPLOY_HOST" 'gunzip | docker load'
  fi
fi

# ── 2. compose + caddy config ────────────────────────────────────────────────
if [ "$skip_restart" -eq 0 ]; then
  echo "── syncing docker-compose.prod.yml + Caddyfile.prod"
  wait_for_host
  caddy_before="$(ssh "$DEPLOY_HOST" "md5sum $DEPLOY_DIR/Caddyfile.prod 2>/dev/null | cut -d' ' -f1" || true)"
  rsync -az docker-compose.prod.yml Caddyfile.prod "$DEPLOY_HOST:$DEPLOY_DIR/"
  caddy_after="$(ssh "$DEPLOY_HOST" "md5sum $DEPLOY_DIR/Caddyfile.prod 2>/dev/null | cut -d' ' -f1" || true)"

  # Caddyfile.prod is bind-mounted as a SINGLE FILE (./Caddyfile.prod ->
  # /etc/caddy/Caddyfile). rsync writes a temp file and renames it over the
  # target, which allocates a NEW inode — and the container is still holding
  # the old one. So neither the rsync nor `caddy reload` has any effect: the
  # container keeps serving the previous config, silently. Only recreating the
  # container re-binds the mount. Guarded on a checksum so the usual deploy
  # doesn't take Caddy (and with it every site) down for no reason.
  if [ -n "$caddy_after" ] && [ "$caddy_before" != "$caddy_after" ]; then
    echo "── Caddyfile changed — recreating caddy so the new inode is picked up"
    ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR && $COMPOSE up -d --force-recreate caddy"
  fi
fi

# ── 3. convex functions ─────────────────────────────────────────────────────
if [ "$skip_convex" -eq 0 ]; then
  if [ ! -f .env.prod ]; then
    echo "✗ .env.prod not found at repo root — required for convex deploy (see DEPLOY.md, layer C)" >&2
    exit 1
  fi
  # The self-hosted backend is a single-core VPS. Convex's push-time module
  # analysis constructs the whole better-auth instance (createApi → 5 plugins)
  # and is CPU-bound against a fixed 4s budget, so any contention on that one
  # core — the --direct image load above, a Next.js SSR burst, postgres — tips
  # it over and the push rejects with:
  #   InvalidModules: … Function execution timed out (maximum duration: 4s)
  # It's transient and the push is atomic (a rejected analyze applies nothing),
  # so retry. Deterministic failures (schema, typecheck, auth config) lack that
  # signature and fail fast on the first attempt.
  echo "── deploying Convex functions"
  convex_log="$(mktemp)"
  for attempt in 1 2 3 4 5; do
    if (cd backend/convex && pnpm with-prod-env npx convex deploy --yes) 2>&1 | tee "$convex_log"; then
      break
    fi
    if ! grep -q 'Function execution timed out' "$convex_log"; then
      echo "✗ convex deploy failed for a non-transient reason (see above) — not retrying" >&2
      rm -f "$convex_log"
      exit 1
    fi
    if [ "$attempt" -eq 5 ]; then
      echo "✗ convex deploy kept hitting the 4s analyze timeout after 5 tries — the VPS is overloaded." >&2
      echo "  Re-run when the box is idle, or ship images only with --skip-convex and push functions separately." >&2
      rm -f "$convex_log"
      exit 1
    fi
    echo "   … analyze timed out under load (attempt $attempt/5) — retrying in 10s (single-core VPS contention)"
    sleep 10
  done
  rm -f "$convex_log"
fi

# ── 4. restart + smoke ───────────────────────────────────────────────────────
if [ "$skip_restart" -eq 0 ]; then
  echo "── restarting ${apps[*]} on $DEPLOY_HOST"
  wait_for_host
  if [ "$direct" -eq 1 ]; then
    ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR && $COMPOSE up -d ${apps[*]}"
  else
    ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR && $COMPOSE pull ${apps[*]} && $COMPOSE up -d ${apps[*]}"
  fi

  echo "── smoke test"
  sleep 5 # let the Next.js servers boot before judging — fresh containers 502 for a few seconds
  for url in https://oknalog.net https://admin.oknalog.net https://tma.oknalog.net; do
    printf '%-28s %s\n' "$url" \
      "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 --retry 3 --retry-all-errors \
        --retry-delay 4 "$url" || echo FAIL)"
  done
  # Self-hosted Convex answers /version with the literal string "unknown" — that's healthy.
  printf '%-28s %s\n' "api /version" "$(curl -sS --max-time 15 https://api.oknalog.net/version || echo FAIL)"

  # The bot serves no HTTP, so curl can't see it — check its log instead.
  #
  # Two separate things can be wrong, and the first hides the second: the bot
  # authenticates with Telegram (getMe) over the *public internet*, but reaches
  # the outbox through Caddy. So it happily reports "authenticated as …" while
  # every poll 404s because /bot/* isn't routed to the Convex site port. Assert
  # on both, and give the drain loop a couple of cycles to prove itself.
  if printf '%s\n' "${apps[@]}" | grep -qx bot; then
    sleep 12
    bot_log="$(ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR && $COMPOSE logs --since 60s bot 2>/dev/null" || true)"
    if ! printf '%s\n' "$bot_log" | grep -q 'authenticated as'; then
      status='NOT AUTHENTICATED — bad TELEGRAM_BOT_TOKEN? docker compose logs bot'
    elif printf '%s\n' "$bot_log" | grep -q 'poll failed'; then
      # Nearly always one of: /bot/* missing from Caddyfile.prod's @site
      # matcher, or BOT_SERVICE_SECRET disagreeing between the VPS .env
      # (layer A) and the Convex deployment (layer B).
      status="POLLING BROKEN — $(printf '%s\n' "$bot_log" | grep -m1 -o '/bot/pending → .*')"
    else
      status='authenticated + draining outbox'
    fi
    printf '%-28s %s\n' "bot" "$status"
  fi
fi

echo "✓ deploy finished ($sha)"
