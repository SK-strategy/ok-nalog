# syntax=docker/dockerfile:1.7
# Build context = monorepo root. Build from there:
#   docker buildx build -f apps/web/Dockerfile -t ghcr.io/netosha/tax-assistant-web:<tag> .

# Stage 1 — prune the monorepo to just this app's dep graph.
# npm-install over corepack avoids the corepack-signature TLS fetch that
# undici flakes on inside BuildKit.
FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
# Generous npm retry timeouts — Docker BuildKit on WSL2 occasionally drops the
# registry TLS connection mid-fetch. Retries inside npm fix it without needing
# a host-side loop.
RUN npm config set fetch-retries 8 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 60000 \
 && npm config set fetch-timeout 120000 \
 && for i in 1 2 3 4 5; do npm install -g turbo@2.5.8 && break || sleep 5; done
WORKDIR /app
COPY . .
RUN turbo prune @tax-assistant/web --docker

# Stage 2 — install deps from the pruned package.jsons.
# Layer caches on the lockfile hash, so a code-only change skips reinstall.
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

# Stage 3 — build the app via turbo.
FROM installer AS builder
COPY --from=pruner /app/out/full/ ./
# CI=1 trips t3-env's `skipValidation` so the build doesn't require CONVEX_URL
# at compile time — those values are read at REQUEST time in the server-rendered
# RootLayout and passed down to client providers as props. That's what makes
# this image env-agnostic (same image runs in staging/prod/laptop).
ENV CI=1
ENV NEXT_TELEMETRY_DISABLED=1

# Sentry is the one exception to the env-agnostic rule above. NEXT_PUBLIC_* is
# inlined into the client bundle by the compiler, so the browser DSN has to be
# present HERE, at build time — passing it at runtime does nothing and browser
# errors would silently never report. Changing it therefore needs a rebuild.
#
# ORG/PROJECT/AUTH_TOKEN drive source-map upload in next.config.js. All four are
# optional: unset means no upload and no client SDK, and the build still
# succeeds (withSentryConfig is configured `silent` with an errorHandler).
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
RUN pnpm exec turbo build --filter=@tax-assistant/web

# Stage 4 — minimal runtime.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# `outputFileTracingRoot` is the monorepo root, so paths inside the standalone
# bundle mirror the workspace layout (apps/web/server.js is the entrypoint).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
