'use client'

import { Check, ChevronDown, ShieldCheck } from 'lucide-react'

import type { ClientType } from '@tax-assistant/validators'
import { Button } from '@tax-assistant/ui/button'
import { formatKopecks } from '@tax-assistant/validators'

import { CategorySearchSheet, categoryStyle } from '~/entities/category'
import type { Doc, Id } from '~/shared/api'
import { cn } from '~/shared/lib'

import type { NewQuestionFormController } from '../model/use-new-question-form'
import { AttachmentList } from './attachment-list'
import { TagPicker } from './tag-picker'

type Category = Doc<'categories'>

const NBSP = ' '

/**
 * The new-question form view. Pure UI driven by a NewQuestionFormController
 * — the controller hook lives at `../model/use-new-question-form`. The view
 * is responsible for rendering the submit button (the TMA equivalent hands
 * submit off to the Telegram MainButton; on web the button lives at the
 * bottom of the form).
 */
export function NewQuestionForm({
  form,
  clientType,
}: {
  form: NewQuestionFormController
  clientType?: ClientType
}) {
  const tooShort = form.description.trim().length < form.minChars
  const tagsDisabled = !form.categoryId

  return (
    <div className="flex flex-col gap-4 pt-4 pb-6">
      <Field label="Категория">
        <CategoryField
          category={form.category}
          loading={form.categoriesLoading && form.categoryId !== undefined}
          clientType={clientType}
          onSelect={form.setCategoryId}
        />
      </Field>

      <Field
        label="Тема"
        hint={
          tagsDisabled
            ? 'Сначала выберите категорию'
            : form.tags === undefined
              ? 'Загрузка тем…'
              : undefined
        }
      >
        <TagPicker
          tags={form.tags ?? undefined}
          value={form.tagId}
          onChange={form.setTagId}
          placeholder={tagsDisabled ? 'Выберите категорию выше' : 'Выберите тему'}
          loading={form.tags === undefined && !tagsDisabled}
          disabled={tagsDisabled}
        />
      </Field>

      <Field
        label="Опишите проблему"
        hint={
          tooShort
            ? `Минимум ${form.minChars} символов`
            : `${form.description.length} / ${form.maxChars}`
        }
        hintTone={tooShort && form.description.length > 0 ? 'warn' : 'muted'}
      >
        <textarea
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          placeholder="Опишите свою ситуацию своими словами. Чем подробнее, тем точнее ответ."
          className={cn(
            'bg-secondary text-foreground placeholder:text-hint min-h-[160px] w-full resize-none',
            'rounded-2xl border border-transparent p-3.5 text-[15px] leading-relaxed outline-none',
            'focus:bg-background focus:border-primary',
          )}
          rows={6}
        />
      </Field>

      <Field label="Вложения">
        <AttachmentList
          files={form.files}
          onAdd={(l) => void form.addFiles(l)}
          onRemove={form.removeFile}
          max={form.maxAttachments}
          uploading={form.uploading}
          uploadError={form.uploadError}
        />
      </Field>

      <div className="text-hint flex items-start gap-2.5 pt-1">
        <ShieldCheck className="size-4 shrink-0 translate-y-px" />
        <p className="text-[13px] leading-relaxed">
          Эксперт не увидит ваше имя и контакты. Только описание и файлы.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        {form.hasDraft ? <DraftBadge /> : <span />}
        <Button
          size="lg"
          disabled={!form.canSubmit}
          onClick={() => void form.submit()}
          className="min-w-[180px]"
        >
          {form.submitting ? 'Отправляем…' : 'Отправить'}
        </Button>
      </div>

      {form.error && <p className="text-destructive text-sm">{form.error}</p>}
    </div>
  )
}

function CategoryField({
  category,
  loading,
  clientType,
  onSelect,
}: {
  category: Category | undefined
  loading: boolean
  clientType?: ClientType
  onSelect: (id: Id<'categories'> | undefined) => void
}) {
  const palette = category ? categoryStyle(category.sortOrder) : null
  const Icon = palette?.icon

  return (
    <CategorySearchSheet
      onSelect={(c) => onSelect(c._id)}
      clientType={clientType}
      selectedId={category?._id}
      trigger={
        <button
          type="button"
          className={cn(
            `group bg-secondary flex w-full items-center gap-3 rounded-2xl border border-transparent
            p-3.5 text-left transition-colors`,
            'data-[state=open]:border-primary data-[state=open]:bg-background',
          )}
        >
          {category && palette && Icon ? (
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: palette.bg, color: palette.fg }}
            >
              <Icon className="size-5" strokeWidth={1.8} />
            </div>
          ) : (
            <div
              className="bg-background flex size-10 shrink-0 items-center justify-center
                rounded-[10px]"
            >
              <ChevronDown className="text-hint size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {category ? (
              <>
                <div className="text-foreground truncate text-[15px] font-semibold">
                  {category.title}
                </div>
                <div className="text-hint mt-0.5 truncate text-[12px]">
                  от{NBSP}
                  {formatKopecks(category.basePrice)}
                </div>
              </>
            ) : (
              <span className="text-hint text-[15px]">
                {loading ? 'Загрузка…' : 'Выберите категорию'}
              </span>
            )}
          </div>
          <ChevronDown
            className="text-hint size-4 shrink-0 transition-transform
              group-data-[state=open]:rotate-180"
          />
        </button>
      }
    />
  )
}

function Field({
  label,
  hint,
  hintTone = 'muted',
  children,
}: {
  label: string
  hint?: string
  hintTone?: 'muted' | 'warn'
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-hint ml-1 block text-[13px] font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <div
          className={cn(
            'mt-1.5 mr-1 text-right text-[12px] tabular-nums',
            hintTone === 'warn' ? 'text-status-pay' : 'text-hint',
          )}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

function DraftBadge() {
  return (
    <div
      className="text-status-done bg-status-done-bg flex items-center gap-1.5 self-start
        rounded-full px-2.5 py-1 text-[12px] font-semibold"
    >
      <Check className="size-3.5" /> Черновик сохранён
    </div>
  )
}
