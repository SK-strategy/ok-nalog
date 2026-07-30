import { Bot } from 'grammy'

import { muteChat, registerChat } from './convex.ts'
import { env } from './env.ts'

// The conversational surface. Intentionally tiny: this bot notifies, it does
// not host the product — the Mini App does. Every command here exists to make
// notifications work or to let someone turn them off.

// Not `as const`: that would make the arrays readonly, which doesn't satisfy
// grammY's mutable InlineKeyboardButton[][].
const OPEN_APP_KEYBOARD = {
  inline_keyboard: [[{ text: 'Открыть приложение', url: env.WEB_ORIGIN }]],
}

export function createBot(): Bot {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN)

  bot.command('start', async (ctx) => {
    const telegramId = ctx.from?.id
    if (telegramId === undefined) return

    // Pressing /start is also the un-mute signal — `registerChat` clears any
    // previous block, which is why a user who blocked and returned starts
    // receiving notifications again without support having to touch anything.
    const { known } = await registerChat(String(telegramId))

    if (known) {
      await ctx.reply(
        'Готово — буду присылать уведомления о ваших заявках.\n\n' +
          'Вы получите сообщение, когда по заявке появится новый ответ.\n' +
          'Отключить: /stop',
        { reply_markup: OPEN_APP_KEYBOARD },
      )
      return
    }

    // No account matches this Telegram id yet. Say so plainly instead of
    // silently registering nothing — otherwise the user waits for
    // notifications that can never arrive.
    await ctx.reply(
      'Привет! Это бот уведомлений «Налогового помощника».\n\n' +
        'Пока я не вижу вашего аккаунта. Войдите через Telegram в приложении — ' +
        'после этого уведомления заработают автоматически.',
      { reply_markup: OPEN_APP_KEYBOARD },
    )
  })

  bot.command('stop', async (ctx) => {
    const telegramId = ctx.from?.id
    if (telegramId === undefined) return
    await muteChat(String(telegramId))
    await ctx.reply('Уведомления отключены. Включить обратно: /start')
  })

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Бот присылает уведомления о новых ответах по вашим заявкам.\n\n' +
        '/start — включить уведомления\n' +
        '/stop — отключить\n\n' +
        'Сами заявки живут в приложении.',
      { reply_markup: OPEN_APP_KEYBOARD },
    )
  })

  // A command handler that throws would otherwise bubble into grammY's
  // long-polling loop and stop update processing — which would also silence
  // /start for everyone. Log and carry on instead.
  bot.catch((err) => {
    console.error('[bot] update handler failed:', err.error)
  })

  return bot
}
