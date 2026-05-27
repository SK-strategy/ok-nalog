'use client'

import { useRef } from 'react'
import { Loader2, Paperclip, X } from 'lucide-react'

import { cn } from '~/shared/lib'

import type { UploadedFile } from '../lib/use-upload'

const ACCEPT = 'image/*,application/pdf,.doc,.docx'
const KB = 1024
const MB = KB * 1024
const MAX_FILE_SIZE = 10 * MB

function formatSize(bytes: number): string {
  if (bytes < KB) return `${bytes} Б`
  if (bytes < MB) return `${Math.round(bytes / KB)} КБ`
  return `${(bytes / MB).toFixed(1)} МБ`
}

function fileKind(type: string, name: string): 'pdf' | 'img' | 'doc' {
  if (type.startsWith('image/')) return 'img'
  if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf'
  return 'doc'
}

/**
 * Multi-file picker with previews. Drives upload via `onAdd`; the parent
 * holds the canonical state so it can also re-hydrate from the server-side
 * draft. The list cap is matched to `MAX_ATTACHMENTS` in validators.
 */
export function AttachmentList({
  files,
  onAdd,
  onRemove,
  max,
  uploading,
  uploadError,
}: {
  files: UploadedFile[]
  onAdd: (files: FileList) => void
  onRemove: (id: UploadedFile['id']) => void
  max: number
  uploading: boolean
  uploadError: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const remaining = max - files.length

  return (
    <div className="flex flex-col gap-2">
      {files.map((f) => {
        const kind = fileKind(f.type, f.name)
        const palette =
          kind === 'pdf'
            ? 'bg-status-fail-bg text-status-fail'
            : kind === 'img'
              ? 'bg-status-work-bg text-status-work'
              : 'bg-tertiary text-text-soft'
        return (
          <div key={f.id} className="bg-secondary flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
                palette,
              )}
            >
              <span className="text-[10px] font-bold uppercase">{kind}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-foreground truncate text-sm font-semibold">{f.name}</div>
              <div className="text-hint text-xs">{formatSize(f.size)}</div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(f.id)}
              aria-label="Убрать вложение"
              className="text-hint p-1"
            >
              <X className="size-[18px]" />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        disabled={remaining <= 0}
        onClick={() => inputRef.current?.click()}
        className={cn(
          `border-separator-strong text-primary flex items-center gap-2.5 rounded-2xl border-[1.5px]
          border-dashed p-3.5`,
          'transition-opacity active:opacity-80 disabled:opacity-55',
        )}
      >
        {uploading ? (
          <Loader2 className="size-[18px] animate-spin" />
        ) : (
          <Paperclip className="size-[18px]" />
        )}
        <span className="text-sm font-semibold">
          {uploading
            ? 'Загрузка…'
            : remaining > 0
              ? files.length === 0
                ? 'Прикрепить файл'
                : 'Добавить ещё'
              : 'Достигнут лимит'}
        </span>
        <span className="text-hint ml-auto text-[13px]">jpg · pdf · doc</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onAdd(e.target.files)
          e.target.value = '' // allow picking the same file twice in a row
        }}
      />

      {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}
    </div>
  )
}

export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE
