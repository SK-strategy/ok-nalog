import { ConvexError, v } from 'convex/values'

import { internalAction } from './_generated/server'
import { sendToSentry } from './lib/sentry'

// Error reporting for the Convex side of the system. The transport lives in
// `lib/sentry.ts`; this file is about *what is worth reporting* and, more
// importantly, *from where it can be reported at all*.
//
// ── Why there is no mutation wrapper ────────────────────────────────────────
//
// The obvious design — wrap every mutation handler, catch, schedule a report,
// rethrow — does not work in Convex, and fails silently, which is worse than
// failing loudly.
//
// A mutation is a transaction, and `ctx.scheduler.runAfter` is part of it. If
// the handler rethrows, the transaction rolls back and takes the scheduled
// report with it. You get no Sentry event and no error either, just the
// original failure and the impression that reporting is broken.
//
// So mutations and queries report only in the cases where they *don't* rethrow
// (a recovered, swallowed error — those commit normally and can schedule
// `reportError`). Genuine mutation/query failures propagate to the client and
// are captured by the apps' own Sentry SDK, which sees them with the route and
// user session attached — strictly more context than we could add here.
//
// Actions and `httpAction`s have no transaction to roll back, so they call
// `sendToSentry` directly via `reportActionError` below.

/**
 * Report an error from a context that cannot fetch — i.e. a mutation that has
 * already handled the error and will NOT rethrow.
 *
 * Schedule it with `ctx.scheduler.runAfter(0, internal.telemetry.reportError, …)`.
 * Read the note above before reaching for this from a `catch` that rethrows.
 */
export const reportError = internalAction({
  args: {
    fnName: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    level: v.optional(v.union(v.literal('error'), v.literal('warning'))),
    tags: v.optional(v.record(v.string(), v.string())),
    extra: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (_ctx, args) => {
    await sendToSentry(args)
  },
})

/**
 * Should this error reach Sentry at all?
 *
 * `ConvexError` is how this codebase expresses *expected* domain refusals —
 * `CHAT_CLOSED`, a failed permission check, a guarded status transition. Those
 * are the system working, and reporting them would bury real bugs under
 * thousands of events. Everything else is unexpected and worth a look.
 */
export function isReportable(error: unknown): boolean {
  return !(error instanceof ConvexError)
}

/** Pull a message and stack off an unknown throwable without losing the odd ones. */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack }
  }
  return { message: typeof error === 'string' ? error : JSON.stringify(error) }
}

/**
 * Run an action / httpAction body, reporting anything unexpected before
 * rethrowing. Safe here precisely because these contexts are not transactional:
 * the `await` completes before the error propagates.
 */
export async function reportActionError<T>(
  fnName: string,
  run: () => Promise<T>,
  tags?: Record<string, string>,
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (isReportable(error)) {
      await sendToSentry({ fnName, ...describeError(error), tags })
    }
    throw error
  }
}

/**
 * `reportActionError` shaped as a drop-in for an `action({ handler })` value.
 *
 * Wrapping the handler rather than its body is what keeps this a two-line
 * change at a call site instead of re-indenting an entire function — which
 * matters because a reporting change should never produce a diff big enough to
 * hide a logic change inside it.
 */
export function reportingHandler<Ctx, Args, Out>(
  fnName: string,
  handler: (ctx: Ctx, args: Args) => Promise<Out>,
): (ctx: Ctx, args: Args) => Promise<Out> {
  return async (ctx, args) => reportActionError(fnName, () => handler(ctx, args))
}
