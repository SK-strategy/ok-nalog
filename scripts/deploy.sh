#!/usr/bin/env bash
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
#   scripts/deploy.sh                  # everything, all three apps
#   scripts/deploy.sh web admin        # only these app images
#   scripts/deploy.sh --skip-images    # convex functions + restart only
#   scripts/deploy.sh --skip-convex    # images + restart only
#   scripts/deploy.sh --skip-restart   # build + push only
#   scripts/deploy.sh --direct         # no registry: save/load images over SSH
#
# Overrides via env:
#   DEPLOY_HOST=deploy@185.103.102.210  DEPLOY_DIR=/opt/tax-assistant
#   REGISTRY=ghcr.io/netosha            PLATFORM=linux/amd64

set -euo pipefail
cd "$(dirname "$0")/.."

DEPLOY_HOST="${DEPLOY_HOST:-deploy@185.103.102.210}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/tax-assistant}"
REGISTRY="${REGISTRY:-ghcr.io/netosha}"
PLATFORM="${PLATFORM:-linux/amd64}"
COMPOSE="docker compose -f docker-compose.prod.yml"

skip_images=0 skip_convex=0 skip_restart=0 direct=0
apps=()
for arg in "$@"; do
  case "$arg" in
    --skip-images) skip_images=1 ;;
    --skip-convex) skip_convex=1 ;;
    --skip-restart) skip_restart=1 ;;
    --direct) direct=1 ;;
    web | admin | tma) apps+=("$arg") ;;
    *)
      echo "unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done
[ ${#apps[@]} -eq 0 ] && apps=(web admin tma)

sha="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠ working tree is dirty — images will be tagged $sha but contain uncommitted changes"
fi

# ── 1. images ────────────────────────────────────────────────────────────────
if [ "$skip_images" -eq 0 ]; then
  if [ "$direct" -eq 1 ]; then output=--load; else output=--push; fi
  for app in "${apps[@]}"; do
    echo "── building $app ($sha, $PLATFORM, $output)"
    docker buildx build \
      --platform "$PLATFORM" \
      -f "apps/$app/Dockerfile" \
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
  rsync -az docker-compose.prod.yml Caddyfile.prod "$DEPLOY_HOST:$DEPLOY_DIR/"
fi

# ── 3. convex functions ─────────────────────────────────────────────────────
if [ "$skip_convex" -eq 0 ]; then
  if [ ! -f .env.prod ]; then
    echo "✗ .env.prod not found at repo root — required for convex deploy (see DEPLOY.md, layer C)" >&2
    exit 1
  fi
  echo "── deploying Convex functions"
  (cd backend/convex && pnpm with-prod-env npx convex deploy --yes)
fi

# ── 4. restart + smoke ───────────────────────────────────────────────────────
if [ "$skip_restart" -eq 0 ]; then
  echo "── restarting ${apps[*]} on $DEPLOY_HOST"
  if [ "$direct" -eq 1 ]; then
    ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR && $COMPOSE up -d ${apps[*]}"
  else
    ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR && $COMPOSE pull ${apps[*]} && $COMPOSE up -d ${apps[*]}"
  fi

  echo "── smoke test"
  for url in https://oknalog.net https://admin.oknalog.net https://tma.oknalog.net; do
    printf '%-28s %s\n' "$url" "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo FAIL)"
  done
  printf '%-28s %s\n' "api /version" "$(curl -sS --max-time 15 https://api.oknalog.net/version || echo FAIL)"
fi

echo "✓ deploy finished ($sha)"
