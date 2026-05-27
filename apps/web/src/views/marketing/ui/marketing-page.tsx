'use client'

import Link from 'next/link'
import { ArrowRight, Clock, FileText, MessageSquareLock, Wallet } from 'lucide-react'

import { Button } from '@tax-assistant/ui/button'

import { TelegramLoginButton } from '~/features/auth'
import { useSession } from '~/entities/session'

const STEPS = [
  {
    title: 'Опишите вопрос',
    body: 'Выберите тематику, опишите ситуацию своими словами, при необходимости приложите файлы.',
    icon: FileText,
  },
  {
    title: 'Утвердим стоимость',
    body: 'Администратор посмотрит обращение и утвердит цену консультации.',
    icon: Wallet,
  },
  {
    title: 'Оплатите за час',
    body: 'На оплату даётся 60 минут — после этого заявка уходит на просрочку.',
    icon: Clock,
  },
  {
    title: 'Получите ответ',
    body: 'Назначенный эксперт ответит в обезличенном чате — без имён и контактов.',
    icon: MessageSquareLock,
  },
] as const

export function MarketingPage() {
  const { me } = useSession()

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-16 px-4 py-12 sm:px-6 sm:py-16">
      <section className="flex flex-col items-center gap-6 text-center">
        <span
          className="bg-primary-soft text-primary inline-flex items-center gap-1.5 rounded-full px-3
            py-1 text-[12px] font-semibold tracking-wide uppercase"
        >
          Налоги без боли
        </span>
        <h1
          className="text-foreground max-w-3xl text-3xl leading-tight font-bold tracking-tight
            sm:text-5xl"
        >
          Консультации по налогам с&nbsp;проверенными экспертами
        </h1>
        <p className="text-text-soft max-w-2xl text-base leading-relaxed sm:text-lg">
          Задайте вопрос, получите оценку стоимости и развёрнутый ответ — всё&nbsp;онлайн,
          в&nbsp;анонимном чате.
        </p>
        {me ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/orders">
                Мои обращения
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/executor">Кабинет эксперта</Link>
            </Button>
          </div>
        ) : (
          <TelegramLoginButton />
        )}
      </section>

      <section>
        <h2 className="text-foreground mb-6 text-center text-2xl font-bold tracking-tight">
          Как это работает
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="bg-card flex flex-col gap-3 rounded-2xl border p-5">
                <div
                  className="bg-primary-soft text-primary flex size-10 items-center justify-center
                    rounded-[10px]"
                >
                  <Icon className="size-5" strokeWidth={1.8} />
                </div>
                <div className="text-hint text-[11px] font-bold tracking-[0.06em] uppercase">
                  Шаг {i + 1}
                </div>
                <h3 className="text-foreground text-base leading-tight font-bold">{step.title}</h3>
                <p className="text-text-soft text-sm leading-relaxed">{step.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      {!me && (
        <section
          className="bg-primary-soft flex flex-col items-center gap-4 rounded-3xl px-6 py-10
            text-center"
        >
          <h2 className="text-foreground max-w-xl text-2xl font-bold tracking-tight">
            Войдите через Telegram, чтобы задать первый вопрос
          </h2>
          <p className="text-text-soft max-w-lg text-sm leading-relaxed">
            Ваше имя и контакты эксперт не видит — только описание обращения и приложенные файлы.
          </p>
          <TelegramLoginButton />
        </section>
      )}
    </main>
  )
}
