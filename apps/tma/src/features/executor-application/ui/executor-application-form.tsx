'use client'

import { Check } from 'lucide-react'

import { categoryStyle } from '~/entities/category'
import { cn } from '~/shared/lib'

import type { ExecutorApplicationController } from '../model/use-executor-application'

/**
 * Pure view for the executor анкета. All state and submission lives in
 * `useExecutorApplication` — this layer just renders the controller. The
 * submit button is intentionally not rendered here; the caller wires either
 * Telegram's MainButton (apply / re-apply screens) or an inline sheet button
 * (approved-user edits).
 */
export function ExecutorApplicationForm({ form }: { form: ExecutorApplicationController }) {
  const bioTrim = form.bio.trim().length
  const qTrim = form.qualifications.trim().length
  const bioShort = bioTrim > 0 && bioTrim < form.minBio
  const qShort = qTrim > 0 && qTrim < form.minQualifications

  return (
    <div className="flex flex-col gap-4">
      <Field label="ФИО">
        <input
          type="text"
          value={form.fullName}
          onChange={(e) => form.setFullName(e.target.value)}
          placeholder="Иван Иванов"
          className={cn(
            'bg-secondary text-foreground placeholder:text-hint w-full rounded-2xl border',
            'focus:bg-background border-transparent p-3.5 text-[15px] outline-none',
            'focus:border-primary',
          )}
        />
      </Field>

      <Field
        label="О себе"
        hint={
          bioShort
            ? `Ещё ${form.minBio - bioTrim} символ${plural(form.minBio - bioTrim)}`
            : `${form.bio.length} / ${form.maxBio}`
        }
        hintTone={bioShort ? 'warn' : 'muted'}
      >
        <textarea
          value={form.bio}
          onChange={(e) => form.setBio(e.target.value)}
          rows={4}
          placeholder="Расскажите о своём подходе, специализации, типичных клиентах."
          className={cn(
            'bg-secondary text-foreground placeholder:text-hint min-h-[112px] w-full resize-none',
            'rounded-2xl border border-transparent p-3.5 text-[15px] leading-relaxed outline-none',
            'focus:bg-background focus:border-primary',
          )}
        />
      </Field>

      <Field
        label="Квалификация и опыт"
        hint={
          qShort
            ? `Ещё ${form.minQualifications - qTrim} символ${plural(form.minQualifications - qTrim)}`
            : `${form.qualifications.length} / ${form.maxQualifications}`
        }
        hintTone={qShort ? 'warn' : 'muted'}
      >
        <textarea
          value={form.qualifications}
          onChange={(e) => form.setQualifications(e.target.value)}
          rows={3}
          placeholder="Образование, сертификаты, годы практики, профильные кейсы."
          className={cn(
            'bg-secondary text-foreground placeholder:text-hint min-h-[88px] w-full resize-none',
            'rounded-2xl border border-transparent p-3.5 text-[15px] leading-relaxed outline-none',
            'focus:bg-background focus:border-primary',
          )}
        />
      </Field>

      <Field
        label="Тематики, по которым консультируете"
        hint={
          form.categoryIds.length === 0
            ? 'Выберите хотя бы одну'
            : `Выбрано: ${form.categoryIds.length}`
        }
        hintTone={form.categoryIds.length === 0 ? 'warn' : 'muted'}
      >
        <CategoryChipGrid form={form} />
      </Field>

      {form.error && <p className="text-destructive text-[13px]">{form.error}</p>}
    </div>
  )
}

// ─── category chip grid ──────────────────────────────────────────────────
function CategoryChipGrid({ form }: { form: ExecutorApplicationController }) {
  if (form.categories === undefined) {
    return (
      <div className="grid grid-cols-1 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-secondary h-14 animate-pulse rounded-2xl" />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-2">
      {form.categories.map((c) => {
        const selected = form.categoryIds.includes(c._id)
        const palette = categoryStyle(c.sortOrder)
        const Icon = palette.icon
        return (
          <button
            key={c._id}
            type="button"
            onClick={() => form.toggleCategory(c._id)}
            className={cn(
              'flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
              'active:opacity-80',
              selected
                ? 'border-primary bg-primary-soft'
                : 'border-separator bg-secondary hover:bg-secondary',
            )}
            aria-pressed={selected}
          >
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: palette.bg, color: palette.fg }}
            >
              <Icon className="size-[18px]" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-foreground truncate text-[14px] font-semibold">{c.title}</div>
              {c.description && (
                <div className="text-text-soft mt-0.5 truncate text-[12px]">{c.description}</div>
              )}
            </div>
            <div
              className={cn(
                `flex size-5 shrink-0 items-center justify-center rounded-full border
                transition-colors`,
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-separator bg-background',
              )}
            >
              {selected && <Check className="size-3.5" strokeWidth={3} />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── shared field shell ──────────────────────────────────────────────────
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

function plural(n: number): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return 'ов'
  if (last === 1) return ''
  if (last >= 2 && last <= 4) return 'а'
  return 'ов'
}
