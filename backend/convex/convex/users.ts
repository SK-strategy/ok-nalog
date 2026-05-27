import { query } from './_generated/server'
import { getUser } from './lib/auth'

// Current session → domain user + executor summary, for role-aware UI routing.
// Identity comes from the JWT minted by better-auth's `convex` plugin and
// verified by Convex via `auth.config.ts`; `getUser` resolves that JWT subject
// to the mirrored domain `Doc<'users'>` (see `../auth.ts` triggers).
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx)
    if (!user) return null
    const profile = await ctx.db
      .query('executorProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
    return {
      user,
      executor: profile ? { status: profile.status, balance: profile.balance } : null,
    }
  },
})
