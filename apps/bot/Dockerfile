# syntax=docker/dockerfile:1.7
# Build context = monorepo root. Build from there:
#   docker buildx build -f apps/bot/Dockerfile -t ghcr.io/netosha/tax-assistant-bot:<tag> .
#
# Same four-stage shape as the Next.js app images, but the output is a plain
# Node service (tsc → dist) rather than a Next standalone bundle.

# Stage 1 — prune the monorepo to just this app's dep graph.
FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
# Generous npm retry timeouts — Docker BuildKit on WSL2 occasionally drops the
# registry TLS connection mid-fetch.
RUN npm config set fetch-retries 8 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 60000 \
 && npm config set fetch-timeout 120000 \
 && for i in 1 2 3 4 5; do npm install -g turbo@2.5.8 && break || sleep 5; done
WORKDIR /app
COPY . .
RUN turbo prune @tax-assistant/bot --docker

# Stage 2 — install deps from the pruned package.jsons.
FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat
RUN npm config set fetch-retries 8 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 60000 \
 && npm config set fetch-timeout 120000 \
 && for i in 1 2 3 4 5; do npm install -g pnpm@10.19.0 && break || sleep 5; done
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Stage 3 — compile TypeScript to dist/.
FROM installer AS builder
COPY --from=pruner /app/out/full/ ./
RUN pnpm exec turbo build --filter=@tax-assistant/bot

# Stage 4 — minimal runtime: prod deps only, plus the compiled output.
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
RUN npm config set fetch-retries 8 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 60000 \
 && npm config set fetch-timeout 120000 \
 && for i in 1 2 3 4 5; do npm install -g pnpm@10.19.0 && break || sleep 5; done
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs bot

# Reinstalling with --prod from the pruned manifests drops eslint/typescript/
# etc., which would otherwise be ~200MB of build tooling shipped to prod.
COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod
COPY --from=builder --chown=bot:nodejs /app/apps/bot/dist ./apps/bot/dist

USER bot
# No EXPOSE and no healthcheck port: this service is outbound-only. It reaches
# Telegram and Convex, and nothing ever connects to it — which is exactly why
# it long-polls instead of taking a webhook.
CMD ["node", "apps/bot/dist/main.js"]
