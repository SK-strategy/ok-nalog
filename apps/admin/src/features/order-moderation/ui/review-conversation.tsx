'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { Download, FileText, Lock, Paperclip } from 'lucide-react'

import { cn } from '@tax-assistant/ui'

import type { Id } from '~/shared/api'
import { api } from '~/shared/api'
import { formatDateTime } from '~/shared/lib'

interface ThreadMessage {
  _id: Id<'messages'>
  senderRole: 'customer' | 'executor' | 'system'
  body: string
  attachmentIds: Id<'_storage'>[]
  audience: 'all' | 'staff'
  createdAt: number
}

interface ResolvedFile {
  url: string | null
  contentType: string | null
  size: number | null
}
type FileMap = Map<Id<'_storage'>, ResolvedFile>

const isImage = (ct: string | null): boolean => !!ct?.startsWith('image/')

const CT_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/zip': 'ZIP',
  'application/x-zip-compressed': 'ZIP',
  'application/x-rar-compressed': 'RAR',
  'application/vnd.rar': 'RAR',
  'application/x-7z-compressed': '7Z',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

/**
 * The full customer ↔ expert dialog the moderator signs off on.
 *
 * The conversation IS the deliverable, so this has to be readable as a
 * conversation rather than a log dump — and, critically, its attachments have
 * to be openable. The previous version rendered "📎 2" as dead text, which made
 * it impossible to actually check an answer that came as a file. Every
 * attachment now resolves to a real URL: images preview inline, everything else
 * becomes a labelled download.
 *
 * Identities stay anonymised — the expert is shown under the same handle the
 * admin knows them by, never a real name.
 */
export function ReviewConversation({
  orderId,
  executorNickname,
  description,
  descriptionAttachmentIds,
  createdAt,
}: {
  orderId: Id<'orders'>
  executorNickname: string | null
  /** The customer's original question — the first turn of the dialog. */
  description: string
  descriptionAttachmentIds: Id<'_storage'>[]
  createdAt: number
}) {
  const messages = useQuery(api.messages.list, { orderId }) as ThreadMessage[] | undefined

  // One batched lookup for every attachment in the thread, including the
  // original question's — resolving per-message would fan out a query per
  // bubble and flicker as each resolved.
  const allIds = useMemo(() => {
    const set = new Set<Id<'_storage'>>(descriptionAttachmentIds)
    if (messages) for (const m of messages) for (const id of m.attachmentIds) set.add(id)
    return [...set].sort()
  }, [descriptionAttachmentIds, messages])

  const rows = useQuery(api.files.getUrls, allIds.length > 0 ? { ids: allIds } : 'skip')
  const fileById = useMemo<FileMap>(() => {
    const m: FileMap = new Map()
    if (rows) for (const r of rows) m.set(r.id, r)
    return m
  }, [rows])

  const executorLabel = executorNickname ?? 'Эксперт'
  const attachmentCount = allIds.length

  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Переписка
        </p>
        {attachmentCount > 0 && (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
            <Paperclip className="size-3" />
            вложений: {attachmentCount}
          </span>
        )}
      </div>

      <div
        className="bg-secondary/30 flex max-h-[46vh] min-h-0 flex-col gap-3 overflow-y-auto
          rounded-lg border p-3"
      >
        <LinkedHistoryNote orderId={orderId} />

        <Bubble
          side="customer"
          label="Заказчик"
          body={description}
          attachmentIds={descriptionAttachmentIds}
          fileById={fileById}
          createdAt={createdAt}
        />

        {messages === undefined && <p className="text-muted-foreground text-xs">Загрузка…</p>}

        {messages?.map((m) =>
          m.senderRole === 'system' ? (
            <SystemLine key={m._id} body={m.body} staffOnly={m.audience === 'staff'} />
          ) : (
            <Bubble
              key={m._id}
              side={m.senderRole}
              label={m.senderRole === 'executor' ? executorLabel : 'Заказчик'}
              body={m.body}
              attachmentIds={m.attachmentIds}
              fileById={fileById}
              createdAt={m.createdAt}
            />
          ),
        )}
      </div>
    </div>
  )
}

interface LinkedThread {
  _id: Id<'orders'>
  description: string
  categoryTitle: string | null
  createdAt: number
  messages: { _id: Id<'messages'>; senderRole: string }[]
}

/**
 * Past заявки the customer attached to this one. The expert reads them while
 * working, so the moderator needs the same context to judge whether the answer
 * actually addressed the history it was given. Kept collapsed-by-default in
 * spirit — a compact summary with the question text, not the full old thread,
 * which would bury the dialog under review.
 */
function LinkedHistoryNote({ orderId }: { orderId: Id<'orders'> }) {
  const linked = useQuery(api.orders.linkedHistory, { orderId }) as LinkedThread[] | undefined
  if (!linked || linked.length === 0) return null
  return (
    <div
      className="border-muted-foreground/25 bg-background/60 rounded-lg border border-dashed p-2.5"
    >
      <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
        Прикреплённые прошлые обращения · {linked.length}
      </p>
      <div className="flex flex-col gap-1.5">
        {linked.map((l) => (
          <div key={l._id} className="text-xs">
            <span className="font-medium">{l.categoryTitle ?? 'Обращение'}</span>
            <span className="text-muted-foreground"> · сообщений: {l.messages.length}</span>
            <p className="text-muted-foreground line-clamp-2">{l.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Bubble({
  side,
  label,
  body,
  attachmentIds,
  fileById,
  createdAt,
}: {
  side: 'customer' | 'executor'
  label: string
  body: string
  attachmentIds: Id<'_storage'>[]
  fileById: FileMap
  createdAt: number
}) {
  const mine = side === 'executor'
  return (
    <div className={cn('flex w-full', mine ? 'justify-end' : 'justify-start')}>
      <div className="flex max-w-[85%] min-w-0 flex-col gap-1">
        <div
          className={cn(
            'flex items-baseline gap-2 text-[11px]',
            mine ? 'justify-end' : 'justify-start',
          )}
        >
          <span className={cn('font-semibold', mine ? 'text-status-work' : 'text-status-search')}>
            {label}
          </span>
          <span className="text-muted-foreground tabular-nums">{formatDateTime(createdAt)}</span>
        </div>

        <div
          className={cn(
            'overflow-hidden rounded-xl border text-sm leading-snug',
            mine ? 'bg-primary-soft border-primary/20' : 'bg-background',
          )}
        >
          {body && <p className="px-3 py-2 break-words whitespace-pre-wrap">{body}</p>}
          {attachmentIds.length > 0 && (
            <div className={cn('flex flex-col gap-1.5 px-3 pb-2', body ? '' : 'pt-2')}>
              {attachmentIds.map((id, i) => (
                <Attachment key={id} index={i + 1} file={fileById.get(id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * A single attachment. Images render as a clickable preview so the moderator
 * can judge them without leaving the dialog; anything else becomes a download
 * link labelled with its type and size.
 */
function Attachment({ index, file }: { index: number; file: ResolvedFile | undefined }) {
  if (!file) {
    return <span className="text-muted-foreground text-xs">Загрузка вложения…</span>
  }
  if (!file.url) {
    return <span className="text-muted-foreground text-xs">Файл недоступен</span>
  }

  if (isImage(file.contentType)) {
    return (
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage urls are dynamic; not in next.config remotePatterns */}
        <img
          src={file.url}
          alt={`Вложение ${index}`}
          loading="lazy"
          className="max-h-56 w-auto rounded-md border object-contain"
        />
      </a>
    )
  }

  const ext = file.contentType ? (CT_LABEL[file.contentType] ?? '') : ''
  const size = formatSize(file.size)
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-secondary/60 hover:bg-secondary inline-flex items-center gap-2 rounded-md border
        px-2.5 py-1.5 text-xs transition-colors"
    >
      <FileText className="size-3.5 shrink-0 opacity-70" />
      <span className="flex-1 font-medium">
        Файл {index}
        {ext && ` · ${ext}`}
      </span>
      {size && <span className="text-muted-foreground tabular-nums">{size}</span>}
      <Download className="size-3.5 shrink-0 opacity-70" />
    </a>
  )
}

function SystemLine({ body, staffOnly }: { body: string; staffOnly: boolean }) {
  return (
    <div className="flex justify-center">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]',
          staffOnly
            ? 'text-muted-foreground/80 border-muted-foreground/25 border border-dashed'
            : 'bg-secondary text-muted-foreground',
        )}
      >
        {staffOnly && <Lock className="size-2.5" />}
        {staffOnly && <span className="font-semibold">Внутреннее ·</span>}
        <span>{body}</span>
      </span>
    </div>
  )
}
