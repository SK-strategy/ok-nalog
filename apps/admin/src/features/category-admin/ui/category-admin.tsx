'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'

import { Button } from '@tax-assistant/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@tax-assistant/ui/card'
import { formatKopecks, rublesToKopecks } from '@tax-assistant/validators'

import { useSession } from '~/entities/session'
import { api } from '~/shared/api'

const fieldClass =
  'border-input bg-background rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none'

/** Create / edit categories and their примерная стоимость. */
export function CategoryAdmin() {
  const { isAuthenticated } = useSession()
  const categories = useQuery(api.categories.listAll, isAuthenticated ? {} : 'skip')
  const create = useMutation(api.categories.create)
  const update = useMutation(api.categories.update)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')

  if (!isAuthenticated) return null

  const canCreate = title.trim().length > 0 && description.trim().length > 0 && Number(price) >= 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Категории</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-2">
          {categories?.map((c) => (
            <div key={c._id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex-1">
                <p className="font-medium">{c.title}</p>
                <p className="text-muted-foreground text-xs">{formatKopecks(c.basePrice)}</p>
              </div>
              <Button
                size="sm"
                variant={c.isActive ? 'outline' : 'secondary'}
                onClick={() => void update({ id: c._id, isActive: !c.isActive })}
              >
                {c.isActive ? 'Скрыть' : 'Включить'}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="font-medium">Новая категория</p>
          <input
            className={fieldClass}
            placeholder="Название"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className={fieldClass}
            inputMode="numeric"
            placeholder="Базовая стоимость, ₽"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!canCreate}
            onClick={() => {
              void create({
                title: title.trim(),
                description: description.trim(),
                basePrice: rublesToKopecks(Number(price)),
                isActive: true,
                sortOrder: categories?.length ?? 0,
              })
              setTitle('')
              setDescription('')
              setPrice('')
            }}
          >
            Создать
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
