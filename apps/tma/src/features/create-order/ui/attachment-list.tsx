'use client'

import { useRef } from 'react'
import { ImageIcon, Loader2, Paperclip, X } from 'lucide-react'

import type { UploadedFile } from '~/shared/lib/use-upload'
import { cn } from '~/shared/lib'
import { getFileExtension, isImageFile } from '~/shared/lib/use-upload'

const ACCEPT = 'image/*,application/pdf,.doc,.docx,.zip,.rar,.7z,.xls,.xlsx,.txt,.csv'
const KB = 1024
const MB = KB * 1024

function formatSize(bytes: number): string {
  if (bytes <= 0) return ''
  if (bytes < KB) return `${bytes} Б`
  if (bytes < MB) return `${Math.round(bytes / KB)} КБ`
  return `${(bytes / MB).toFixed(1)} МБ`
}

const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2'])
const SPREADSHEET_EXTS = new Set(['xls', 'xlsx', 'csv', 'ods'])
const DOCUMENT_EXTS = new Set(['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt'])

interface BadgeStyle {
  palette: string
  label: string
  icon: 'image' | null
}

// Picks the palette + small label for the file's square badge. Images get a
// dedicated icon (the user can't read "JPG" at thumbnail size and we don't
// have a real preview URL once the file's uploaded to Convex storage); every
// other file shows its actual extension (PDF, DOCX, ZIP, …) so the kind is
// readable at a glance.
function fileBadge(type: string, name: string): BadgeStyle {
  if (isImageFile(type, name)) {
    return { palette: 'bg-status-work-bg text-status-work', label: '', icon: 'image' }
  }
  const ext = getFileExtension(name)
  if (ext === 'pdf')
    return { palette: 'bg-status-fail-bg text-status-fail', label: 'PDF', icon: null }
  if (ARCHIVE_EXTS.has(ext)) {
    return { palette: 'bg-status-pay-bg text-status-pay', label: ext.toUpperCase(), icon: null }
  }
  if (SPREADSHEET_EXTS.has(ext)) {
    return { palette: 'bg-status-done-bg text-status-done', label: ext.toUpperCase(), icon: null }
  }
  if (DOCUMENT_EXTS.has(ext)) {
    return { palette: 'bg-tertiary text-text-soft', label: ext.toUpperCase(), icon: null }
  }
  return {
    palette: 'bg-tertiary text-text-soft',
    label: ext ? ext.toUpperCase() : 'FILE',
    icon: null,
  }
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
        const badge = fileBadge(f.type, f.name)
        const size = formatSize(f.size)
        return (
          <div key={f.id} className="bg-secondary flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
                badge.palette,
              )}
            >
              {badge.icon === 'image' ? (
                <ImageIcon className="size-5" strokeWidth={1.8} />
              ) : (
                <span className="text-[10px] font-bold uppercase">{badge.label}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-foreground truncate text-sm font-semibold">{f.name}</div>
              {size && <div className="text-hint text-xs">{size}</div>}
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
        <span className="text-hint ml-auto text-[13px]">jpg · pdf · doc · zip</span>
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
