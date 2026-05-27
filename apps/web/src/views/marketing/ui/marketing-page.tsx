'use client'

import Link from 'next/link'

import { Button } from '@tax-assistant/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'

import { TelegramLoginButton } from '~/features/auth'
import { useSession } from '~/entities/session'

const STEPS = [
  ['Опишите вопрос', 'Выберите тематику и подробно опишите налоговую проблему.'],
  ['Эксперт и стоимость', 'Администратор проверит заявку и утвердит стоимость консультации.'],
  ['Оплата', 'Оплатите консультацию — на это даётся 1 час.'],
  ['Ответ', 'Назначенный эксперт ответит в обезличенном диалоге.'],
] as const

export function MarketingPage() {
  const { me } = useSession()

  return (
    <main className="container mx-auto flex flex-col gap-16 py-16">
      <section className="flex flex-col items-center gap-6 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Налоговые консультации с проверенными экспертами
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Задайте вопрос, получите оценку стоимости и ответ эксперта — полностью онлайн.
        </p>
        {me ? (
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/orders">Мои заявки</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/cabinet">Стать исполнителем</Link>
            </Button>
          </div>
        ) : (
          <TelegramLoginButton />
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([title, body], i) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-base">
                {i + 1}. {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">{body}</CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
