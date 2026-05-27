'use client'

import { useEffect, useState } from 'react'
import { useMutation } from 'convex/react'

import type { ClientType } from '@tax-assistant/validators'
import { Button } from '@tax-assistant/ui/button'
import { Checkbox } from '@tax-assistant/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tax-assistant/ui/dialog'
import { Input } from '@tax-assistant/ui/input'
import { Label } from '@tax-assistant/ui/label'
import {
  CLIENT_TYPE_LABEL,
  CLIENT_TYPES,
  formatKopecks,
  kopecksToRubles,
  rublesToKopecks,
} from '@tax-assistant/validators'

import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pass a category to edit; omit to create a new one. */
  category?: Doc<'categories'>
  /** Used to assign sortOrder when creating. */
  nextSortOrder: number
}

interface FormState {
  title: string
  description: string
  priceRub: string
  code: string
  clientTypes: ClientType[]
  isActive: boolean
}

const EMPTY: FormState = {
  title: '',
  description: '',
  priceRub: '',
  code: '',
  clientTypes: [],
  isActive: true,
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  nextSortOrder,
}: CategoryFormDialogProps) {
  const create = useMutation(api.categories.create)
  const update = useMutation(api.categories.update)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (category) {
      setForm({
        title: category.title,
        description: category.description,
        priceRub: String(kopecksToRubles(category.basePrice)),
        code: category.code ?? '',
        clientTypes: [...(category.clientTypes ?? [])],
        isActive: category.isActive,
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, category])

  const editing = !!category
  const priceNumber = Number(form.priceRub)
  const canSubmit =
    form.title.trim().length > 0 && form.description.trim().length > 0 && priceNumber >= 0

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }))
  }

  function toggleType(t: ClientType) {
    patch({
      clientTypes: form.clientTypes.includes(t)
        ? form.clientTypes.filter((x) => x !== t)
        : [...form.clientTypes, t],
    })
  }

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const basePrice = rublesToKopecks(priceNumber)
      const clientTypes = form.clientTypes.length > 0 ? form.clientTypes : undefined
      const code = form.code.trim() || undefined
      if (editing) {
        await update({
          id: category._id as Id<'categories'>,
          title: form.title.trim(),
          description: form.description.trim(),
          basePrice,
          isActive: form.isActive,
          clientTypes,
        })
      } else {
        await create({
          title: form.title.trim(),
          description: form.description.trim(),
          basePrice,
          isActive: form.isActive,
          sortOrder: nextSortOrder,
          code,
          clientTypes,
        })
      }
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Редактировать категорию' : 'Новая категория'}</DialogTitle>
          <DialogDescription>Тематика, доступная клиентам при создании заявки.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-title">Название</Label>
            <Input
              id="cat-title"
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Например, Налоговые проверки"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-desc">Описание</Label>
            <Input
              id="cat-desc"
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Что входит в категорию"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-price">Базовая стоимость, ₽</Label>
              <Input
                id="cat-price"
                inputMode="numeric"
                value={form.priceRub}
                onChange={(e) => patch({ priceRub: e.target.value })}
                placeholder="0"
              />
              {priceNumber > 0 && (
                <span className="text-muted-foreground text-xs">
                  ≈ {formatKopecks(rublesToKopecks(priceNumber))}
                </span>
              )}
            </div>
            {!editing && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cat-code">Код (опционально)</Label>
                <Input
                  id="cat-code"
                  value={form.code}
                  onChange={(e) => patch({ code: e.target.value })}
                  placeholder="tax_audit"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Подходит для клиентов</Label>
            <div className="flex flex-col gap-2">
              {CLIENT_TYPES.map((t) => (
                <label
                  key={t}
                  className="hover:bg-secondary/50 flex cursor-pointer items-center gap-2.5
                    rounded-md border px-3 py-2 transition-colors"
                >
                  <Checkbox
                    checked={form.clientTypes.includes(t)}
                    onCheckedChange={() => toggleType(t)}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{CLIENT_TYPE_LABEL[t].full}</span>
                    <span className="text-muted-foreground text-xs">
                      {CLIENT_TYPE_LABEL[t].short}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Если не выбрано — категория доступна всем (через теги).
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={(v) => patch({ isActive: v === true })}
            />
            <span className="text-sm font-medium">Категория активна</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit || submitting}>
            {submitting ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
