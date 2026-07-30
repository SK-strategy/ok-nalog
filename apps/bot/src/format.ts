import type { ActorRole, DeliverableNotification } from './convex.ts'
import { env } from './env.ts'

// Rendering of outgoing notifications.
//
// Two invariants hold here, and both are load-bearing:
//
//  1. NOTHING identifies the other party. The payload carries an `actorRole`
//     and nothing else about who acted — no name, no username, and explicitly
//     no позывной, which is internal cover between the admin and the experts
//     and must never reach a client. If you find yourself wanting a name in
//     this file, the answer is no.
//  2. Every interpolated value is HTML-escaped. Message bodies are arbitrary
//     user text; unescaped `<` would break the parse and let a customer inject
//     markup into a notification rendered on someone else's phone.

/** Last 4 chars of a Convex id, uppercased — matches «№ A1B2» in the apps. */
function shortId(id: string): string {
  return id.slice(-4).toUpperCase()
}

/** Escape the five characters that matter for Telegram's HTML parse mode. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;')
}

/** How the acting party is named to the recipient. Roles only, never people. */
const ACTOR_LABEL: Record<ActorRole, string> = {
  customer: 'Заказчик',
  executor: 'Эксперт',
  moderator: 'Модератор',
}

export interface RenderedNotification {
  text: string
  orderUrl: string
}

export function renderNotification(n: DeliverableNotification): RenderedNotification {
  const actor = escapeHtml(ACTOR_LABEL[n.actorRole])
  const preview = escapeHtml(n.preview)
  const number = escapeHtml(shortId(n.orderId))

  const heading =
    n.kind === 'moderator_note'
      ? `📝 <b>Заявка № ${number}</b> — на доработку`
      : `🔔 <b>Новый ответ по заявке № ${number}</b>`

  const lines = [heading, '']
  if (n.categoryTitle) lines.push(`<i>${escapeHtml(n.categoryTitle)}</i>`, '')
  lines.push(`<b>${actor}:</b> «${preview}»`)

  return {
    text: lines.join('\n'),
    // The TMA has no `startapp` deep-link routing yet, so this points at the
    // web app, which resolves for every user. Swap to a `t.me/<bot>/<app>`
    // link once the Mini App can route an incoming order id.
    orderUrl: `${env.WEB_ORIGIN}/orders/${n.orderId}`,
  }
}
