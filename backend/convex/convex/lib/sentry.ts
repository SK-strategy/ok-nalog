// Minimal Sentry ingest client for the Convex runtime.
//
// `@sentry/node` isn't usable here: Convex functions run in a custom V8 isolate
// rather than Node, so pulling the SDK in would mean marking every reporting
// call site `"use node"` and shipping a large dependency to do what is, at
// bottom, one POST. The envelope format is stable and public, so this hand-
// rolled sender stays small and has no dependencies.
//
// Everything below is a no-op when `SENTRY_DSN` is unset on the deployment.
// That mirrors the apps (`apps/*/src/instrumentation.ts`): the plumbing ships
// wired up, and pointing it at a project is a config change, not a code change.

/** Level names Sentry understands. We only ever send the top two. */
export type SentryLevel = 'error' | 'warning'

export interface SentryReport {
  /** Convex function path that failed, e.g. `orders:approvePrice`. Becomes the Sentry transaction. */
  fnName: string
  message: string
  stack?: string
  level?: SentryLevel
  /** Searchable, low-cardinality key/values — indexed by Sentry for filtering. */
  tags?: Record<string, string>
  /** Free-form detail shown on the event. Never put PII or message bodies here. */
  extra?: Record<string, unknown>
}

interface ParsedDsn {
  envelopeUrl: string
  publicKey: string
}

/**
 * Split a DSN into the ingest URL and public key.
 *
 * DSN shape: `https://<publicKey>@<host>/<projectId>` → envelopes POST to
 * `https://<host>/api/<projectId>/envelope/`. Returns null rather than throwing
 * on a malformed DSN: a typo'd DSN must not take down the request it was only
 * ever meant to describe.
 */
export function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace(/^\//u, '')
    if (!url.username || !projectId) return null
    return {
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
    }
  } catch {
    return null
  }
}

/** Sentry wants a 32-char hex id with no dashes. */
function eventId(): string {
  return crypto.randomUUID().replace(/-/gu, '')
}

/**
 * Build the three-line envelope body: header, item header, then the event.
 *
 * Exported for testing and so the shape is readable in one place — the format
 * is newline-delimited JSON and is easy to get subtly wrong.
 */
export function buildEnvelope(report: SentryReport, environment: string): string {
  const id = eventId()
  const sentAt = new Date().toISOString()

  const event = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: report.level ?? 'error',
    logger: 'convex',
    // Groups every failure of one Convex function together in the issue stream.
    transaction: report.fnName,
    environment,
    server_name: 'convex',
    exception: {
      values: [
        {
          type: report.fnName,
          value: report.message,
        },
      ],
    },
    tags: { runtime: 'convex', fn: report.fnName, ...report.tags },
    // The isolate gives us a plain string stack and no source map, so it rides
    // along as context rather than as parsed frames Sentry would mis-symbolicate.
    extra: { ...report.extra, ...(report.stack ? { stack: report.stack } : {}) },
  }

  return `${JSON.stringify({ event_id: id, sent_at: sentAt })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}`
}

/**
 * Ship one event. Resolves regardless of outcome.
 *
 * Reporting an error must never itself throw: every call site is already on a
 * failure path, and a rejection here would replace the real error with a
 * useless one about telemetry. Failures are logged to the Convex function log,
 * which is where someone debugging missing Sentry events will look.
 */
export async function sendToSentry(report: SentryReport): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  const parsed = parseDsn(dsn)
  if (!parsed) {
    console.error('[sentry] SENTRY_DSN is set but malformed — not reporting')
    return
  }

  try {
    const response = await fetch(parsed.envelopeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=tax-assistant-convex/1.0`,
      },
      body: buildEnvelope(report, process.env.SENTRY_ENVIRONMENT ?? 'production'),
      // Sentry being slow or down must not hold a Convex action open.
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) {
      console.error(`[sentry] ingest rejected the event: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    console.error('[sentry] could not reach ingest:', error)
  }
}
