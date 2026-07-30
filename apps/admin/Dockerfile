# syntax=docker/dockerfile:1.7
# Build context = monorepo root:
#   docker buildx build -f apps/admin/Dockerfile -t ghcr.io/netosha/tax-assistant-admin:<tag> .

FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN npm config set fetch-retries 8 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 60000 \
 && npm config set fetch-timeout 120000 \
 && for i in 1 2 3 4 5; do npm install -g turbo@2.5.8 && break || sleep 5; done
WORKDIR /app
COPY . .
RUN turbo prune @tax-assistant/admin --docker

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

FROM installer AS builder
COPY --from=pruner /app/out/full/ ./
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
RUN pnpm exec turbo build --filter=@tax-assistant/admin

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
