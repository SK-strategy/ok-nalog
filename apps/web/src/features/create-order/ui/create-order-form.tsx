'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'
import { formatKopecks } from '@tax-assistant/validators'

import { useSession } from '~/entities/session'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'

export function CreateOrderForm({ onCreated }: { onCreated?: () => void }) {
  const { isAuthenticated } = useSession()
  const categories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')
  const create = useMutation(api.orders.create)

  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    isAuthenticated && !!categoryId && description.trim().length >= 20 && !submitting

  async function submit() {
    if (!isAuthenticated || !categoryId) return
    setSubmitting(true)
    setError(null)
    try {
      await create({
        categoryId: categoryId as Parameters<typeof create>[0]['categoryId'],
        description: description.trim(),
        attachmentIds: [],
      })
      setDescription('')
      setCategoryId(null)
      onCreated?.()
    } catch {
      setError('Не удалось создать заявку')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новая заявка</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Тематика обращения</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories?.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => setCategoryId(c._id)}
                className={cn(
                  'rounded-lg border p-3 text-left text-sm transition-colors',
                  categoryId === c._id ? 'border-primary bg-accent' : 'hover:bg-accent/50',
                )}
              >
                <span className="font-medium">{c.title}</span>
                <span className="text-muted-foreground block text-xs">
                  Ориентировочно {formatKopecks(c.basePrice)}
                </span>
              </button>
            ))}
            {categories?.length === 0 && (
              <p className="text-muted-foreground text-sm">Категории пока не заданы.</p>
            )}
          </div>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Опишите проблему
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Подробно опишите ваш налоговый вопрос (минимум 20 символов)"
            className="border-input bg-background focus-visible:ring-ring rounded-md border px-3
              py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button disabled={!canSubmit} onClick={() => void submit()}>
          {submitting ? 'Отправка…' : 'Отправить на проверку'}
        </Button>
      </CardContent>
    </Card>
  )
}
