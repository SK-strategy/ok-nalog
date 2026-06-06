# syntax=docker/dockerfile:1.7
# Build context = monorepo root:
#   docker buildx build -f apps/admin/Dockerfile -t ghcr.io/netosha/tax-assistant-admin:<tag> .

FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.5.8 prune @tax-assistant/admin --docker

FROM node:22-alpine AS installer
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /app/out/full/ ./
ENV CI=1
ENV NEXT_TELEMETRY_DISABLED=1
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
