import { ConvexError } from 'convex/values'

import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { authComponent } from '../auth'

type AnyCtx = QueryCtx | MutationCtx

// Domain user — the application identity. Authentication is owned by the
// better-auth component (`user`, `session`, … inside its namespace); this
// helper hides that and returns the mirrored domain `Doc<'users'>` so the
// rest of the codebase only talks about `Id<'users'>`. The mirror is kept in
// sync by the user triggers wired in `../auth.ts`.

export async function getUser(ctx: AnyCtx): Promise<Doc<'users'> | null> {
  const authUser = await authComponent.safeGetAuthUser(ctx)
  if (!authUser) return null
  const domainUser = await ctx.db
    .query('users')
    .withIndex('by_auth_user', (q) => q.eq('authUserId', authUser._id))
    .unique()
  return domainUser
}

export async function requireUser(ctx: AnyCtx): Promise<Doc<'users'>> {
  const user = await getUser(ctx)
  if (!user) throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Требуется вход' })
  return user
}

export async function requireAdmin(ctx: AnyCtx): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  if (user.role !== 'admin') {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Только для администратора' })
  }
  return user
}

export async function requireExecutor(
  ctx: AnyCtx,
): Promise<{ user: Doc<'users'>; profile: Doc<'executorProfiles'> }> {
  const user = await requireUser(ctx)
  const profile = await ctx.db
    .query('executorProfiles')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique()
  if (profile?.status !== 'approved') {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Только для одобренного исполнителя' })
  }
  return { user, profile }
}
