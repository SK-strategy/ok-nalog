# @tax-assistant/bot

Telegram notification worker. Tells a customer when their expert replies, and an expert when their
customer replies or a moderator sends work back.

It is **the same bot** as the Mini App and Login Widget (same `TELEGRAM_BOT_TOKEN`). That is the
whole reason notifications work with no onboarding: anyone who has opened the TMA has already
started a chat with this bot, and a Telegram user id doubles as the private chat id.

## How a notification travels

```
messages.send (Convex mutation)
   └─ enqueueNotification()          lib/notifications.ts — decides WHO and WHAT
        └─ notifications table       the outbox: status pending → delivered
             └─ POST /bot/pending    apps/bot polls, bearer-authenticated
                  └─ bot.api.sendMessage
                       └─ POST /bot/ack   delivered | blocked | failed
```

Convex decides _what_ may be said; this service decides _when_ it reaches Telegram. The queue
between them exists because Telegram rate-limits and fails transiently, and because a slow
`sendMessage` must never sit inside the write path of `messages.send`.

## Design decisions worth knowing

**Polling, not webhooks.** The service needs no inbound reachability — no Caddy route, no public
hostname, no webhook secret to rotate. It also self-heals: after a restart or an outage it simply
finds whatever is still `pending`. The cost is a few-second delay on an indexed, usually-empty
query.

**One replica, always.** Telegram permits exactly one long-polling consumer per bot token. A second
replica makes both flap with `409 Conflict`.

**Coalescing.** Five quick messages on one order buzz the recipient once, showing the most recent
excerpt. Handled at enqueue time by rewriting the still-pending row instead of inserting another.

**`blocked` vs `failed`.** A 403 (bot blocked, account deleted) is permanent, so it flags the user
and stops all future queuing for them. Everything else — 429, 5xx, network — is transient and backs
off 30s → 1m → 2m → 4m, then gives up. The permanent bucket is deliberately narrow: misfiling a
rate-limit as "blocked" would switch someone's notifications off forever.

**No identities, ever.** The queue row carries an `actorRole` (`customer` / `executor` /
`moderator`) and nothing else about who acted. In particular it never carries the executor's
позывной, which is internal cover between the admin and his experts — see `lib/notifications.ts` and
`src/format.ts`.

## Commands

| Command  | Effect                                                         |
| -------- | -------------------------------------------------------------- |
| `/start` | Enable notifications. Also clears a previous block or `/stop`. |
| `/stop`  | Mute, and drop anything already queued for this user.          |
| `/help`  | What the bot does.                                             |

## Local development

Needs `TELEGRAM_BOT_TOKEN`, `CONVEX_SITE_URL`, `WEB_ORIGIN` and `BOT_SERVICE_SECRET` in the
repo-root `.env`, plus the same `BOT_SERVICE_SECRET` on the Convex deployment:

```bash
openssl rand -hex 32                                   # put in .env
pnpm with-env npx convex env set BOT_SERVICE_SECRET <value>
pnpm -F @tax-assistant/bot dev
```

Running this locally while a prod instance polls the same token will make both drop updates — stop
one first.

## Extending

`kind` on the outbox row is a union, and `enqueueNotification` is the single entry point. Adding
lifecycle notifications (price approved, expert assigned, order closed) means one
`enqueueNotification` call at the transition plus a heading in `src/format.ts` — no changes to the
transport.
