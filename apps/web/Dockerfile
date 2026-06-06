# syntax=docker/dockerfile:1.7
# Build context = monorepo root. Build from there:
#   docker buildx build -f apps/web/Dockerfile -t ghcr.io/netosha/tax-assistant-web:<tag> .

# Stage 1 — prune the monorepo to just this app's dep graph.
FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.5.8 prune @tax-assistant/web --docker

# Stage 2 — install deps from the pruned package.jsons.
# Layer caches on the lockfile hash, so a code-only change skips reinstall.
FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
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
