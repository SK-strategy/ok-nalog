'use client'

import { useEffect, useState } from 'react'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Check, Dices } from 'lucide-react'

import { Button } from '@tax-assistant/ui/button'
import { Input } from '@tax-assistant/ui/input'
import { isValidNickname, NICKNAME_MAX_LENGTH, normalizeNickname } from '@tax-assistant/validators'

import type { Id } from '~/shared/api'
import { api } from '~/shared/api'

interface NicknameEditorProps {
  profileId: Id<'executorProfiles'>
  /** Current handle; `undefined` on profiles created before nicknames existed. */
  nickname: string | undefined
}

/**
 * Admin control for the executor's customer-facing handle — the only place
 * it can be changed. Free text (validated + uniqueness-checked server-side)
 * with a dice button that rolls a fresh «Прилагательное Животное» pair.
 *
 * The stored handle arrives via a reactive query, so the draft resyncs
 * whenever it changes underneath us (e.g. after a re-roll).
 */
export function NicknameEditor({ profileId, nickname }: NicknameEditorProps) {
  const setNickname = useMutation(api.executors.adminSetNickname)
  const regenerate = useMutation(api.executors.adminRegenerateNickname)

  const [draft, setDraft] = useState(nickname ?? '')
  const [busy, setBusy] = useState<false | 'save' | 'roll'>(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDraft(nickname ?? '')
  }, [nickname])

  // Confirmation tick fades on its own so the row doesn't keep stale state.
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(t)
  }, [saved])

  const trimmed = normalizeNickname(draft)
  const dirty = trimmed !== (nickname ?? '')
  const canSave = dirty && isValidNickname(trimmed) && busy === false

  async function run(kind: 'save' | 'roll') {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'save') await setNickname({ profileId, nickname: trimmed })
      else await regenerate({ profileId })
      setSaved(true)
    } catch (e) {
      // ConvexError carries our typed { code, message } payload; anything
      // else is a transport failure and gets a generic line.
      setError(
        e instanceof ConvexError && typeof e.data === 'object' && e.data !== null
          ? ((e.data as { message?: string }).message ?? 'Не удалось сохранить')
          : 'Не удалось сохранить',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">
        Псевдоним для клиентов
        {saved && (
          <span className="text-status-done ml-2 inline-flex items-center gap-1">
            <Check className="size-3" />
            сохранено
          </span>
        )}
      </span>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          maxLength={NICKNAME_MAX_LENGTH}
          placeholder="Например, Мудрый Барсук"
          disabled={busy !== false}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) void run('save')
          }}
          className="max-w-xs"
        />
        <Button
          size="icon"
          variant="outline"
          title="Сгенерировать новый псевдоним"
          aria-label="Сгенерировать новый псевдоним"
          disabled={busy !== false}
          onClick={() => void run('roll')}
        >
          <Dices className="size-4" />
        </Button>
        <Button size="sm" disabled={!canSave} onClick={() => void run('save')}>
          {busy === 'save' ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
      <p className={error ? 'text-status-fail text-xs' : 'text-muted-foreground text-xs'}>
        {error ?? 'Настоящее имя исполнителя клиенту не показывается — только этот псевдоним.'}
      </p>
    </div>
  )
}
