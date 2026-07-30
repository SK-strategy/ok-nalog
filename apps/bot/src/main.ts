import { createBot } from './bot.ts'
import { env } from './env.ts'
import { captureFatal, initSentry } from './sentry.ts'
import { startWorker } from './worker.ts'

// Entrypoint. One process runs two concurrent jobs against the same bot token:
//   • grammY long-polling  — inbound /start, /stop, /help
//   • the outbox worker    — outbound notifications
//
// They share a process so there's a single Telegram consumer. Splitting them
// would mean two long-pollers on one token, which Telegram answers with
// 409 Conflict. For the same reason: do not scale this service past one replica.

async function main(): Promise<void> {
  // Before anything that can throw — a bad token or unreachable Convex should
  // arrive as a Sentry event, not just a line in a container log nobody tails.
  initSentry()

  const bot = createBot()
  const shutdown = new AbortController()

  // Resolve the bot's own identity up front. It doubles as a credential check —
  // a bad token fails here with a clear message instead of surfacing later as
  // mysterious silence.
  const me = await bot.api.getMe()
  console.log(`[bot] authenticated as @${me.username} (${env.NODE_ENV})`)

  const worker = startWorker(bot, shutdown.signal)

  let stopping = false
  const stop = (signal: string): void => {
    if (stopping) return
    stopping = true
    console.log(`[bot] ${signal} — shutting down`)
    shutdown.abort()
    // grammY finishes the in-flight update batch before resolving, so an
    // in-progress /start isn't dropped mid-handler on a deploy.
    void bot.stop()
  }
  process.once('SIGTERM', () => stop('SIGTERM'))
  process.once('SIGINT', () => stop('SIGINT'))

  console.log(`[bot] polling outbox every ${env.BOT_POLL_INTERVAL_MS}ms`)
  // `bot.start()` resolves only once the bot is stopped.
  await Promise.all([bot.start({ drop_pending_updates: false }), worker])
  console.log('[bot] stopped')
}

main().catch(async (error: unknown) => {
  console.error('[bot] fatal:', error)
  // Flush before exiting, or the event dies with the process.
  await captureFatal(error)
  process.exit(1)
})
