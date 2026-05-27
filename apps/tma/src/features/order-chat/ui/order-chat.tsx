'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Loader2, Paperclip, SendHorizontal, X } from 'lucide-react'

import { canPostMessage, MAX_ATTACHMENTS } from '@tax-assistant/validators'

import { formatChatTimestamp } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import type { UploadedFile } from '~/shared/lib/use-upload'
import { api } from '~/shared/api'
import { cn } from '~/shared/lib'
import { getFileExtension, useUpload, validateFile } from '~/shared/lib/use-upload'

type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>
interface ChatMessage {
  _id: Id<'messages'>
  senderRole: 'customer' | 'executor' | 'system'
  body: string
  attachmentIds: Id<'_storage'>[]
  createdAt: number
  mine: boolean
}
type Role = 'customer' | 'executor' | 'admin'

interface ResolvedAttachment {
  url: string | null
  contentType: string | null
  size: number | null
}
type AttachmentMap = Map<Id<'_storage'>, ResolvedAttachment>

const ACCEPT = 'image/*,application/pdf,.doc,.docx,.zip,.rar,.7z,.xls,.xlsx,.txt,.csv'

const isImage = (ct: string | null | undefined): boolean => !!ct && ct.startsWith('image/')

// Best-effort extension label for received attachments (we don't store the
// original filename on messages, so MIME is the only signal). Falls through
// to '' when the content type isn't one we have a mapping for.
const CT_EXTENSION: Record<string, string> = {
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
const extensionFromContentType = (ct: string | null): string => (ct ? (CT_EXTENSION[ct] ?? '') : '')

/**
 * The order timeline + composer. Rendered as a chat-style ticket:
 *  - Customer's original description shows as the first bubble.
 *  - System messages appear inline as small centered pills with timestamps.
 *  - Customer/executor messages are bubbles (mine right-aligned, theirs left).
 *    Identities stay anonymized — only role labels are shown.
 *  - Attachments are resolved in a single `files.getUrls` round-trip so we
 *    can render images inline and other types as a clickable pill.
 *  - The composer supports text + file attachments (paperclip → file
 *    picker). A message can carry attachments only, text only, or both.
 *  - `action` is an inline slot rendered just before the composer so the
 *    view can drop status-driven action cards into the timeline without
 *    coupling them to the chat feature.
 *  - Composer visibility follows `canPostMessage(role, status)`: customer
 *    can write in any non-terminal status (they may follow up or attach
 *    extra documents until the order is closed); executor can write only
 *    while the chat window is open (assigned / in_progress / answered).
 *    Outside that, the chat renders read-only.
 */
export function OrderChat({
  order,
  role,
  action,
}: {
  order: Order
  role: Role
  action?: React.ReactNode
}) {
  const { isAuthenticated } = useSession()
  const messages = useQuery(
    api.messages.list,
    isAuthenticated ? { orderId: order._id } : 'skip',
  ) as ChatMessage[] | undefined
  const send = useMutation(api.messages.send)

  // Collect every attachment id we'll need to render and resolve URLs in one
  // query. Deduped + sorted so the cache key stays stable when new messages
  // arrive in different orders.
  const allAttachmentIds = useMemo(() => {
    const set = new Set<Id<'_storage'>>(order.attachmentIds)
    if (messages) for (const m of messages) for (const id of m.attachmentIds) set.add(id)
    return [...set].sort()
  }, [order.attachmentIds, messages])

  const attachmentRows = useQuery(
    api.files.getUrls,
    isAuthenticated && allAttachmentIds.length > 0 ? { ids: allAttachmentIds } : 'skip',
  )
  const urlById = useMemo<AttachmentMap>(() => {
    const m: AttachmentMap = new Map()
    if (attachmentRows) {
      for (const r of attachmentRows) {
        m.set(r.id, { url: r.url, contentType: r.contentType, size: r.size })
      }
    }
    return m
  }, [attachmentRows])

  // Auto-scroll to the bottom when new messages arrive.
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageCount = messages?.length ?? 0
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messageCount])

  // Customer can chat in any non-terminal status; executor only in the
  // assigned/in_progress/answered window. Admin never participates.
  const composerEnabled = role !== 'admin' && canPostMessage(role, order.status)

  const submitMessage = useCallback(
    async (body: string, attachmentIds: Id<'_storage'>[]) => {
      await send({ orderId: order._id, body, attachmentIds })
    },
    [send, order._id],
  )

  const showActionBar = !!action || composerEnabled

  return (
    // `flex-1 min-h-0` rather than `h-full`: percentage heights don't resolve
    // reliably against a flex-determined parent height across browsers, while
    // `flex-1` is unambiguous. `min-h-0` lets this flex child shrink below
    // its content so the inner timeline can scroll instead of pushing the
    // composer off-screen (which is what made the whole page scroll).
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <ChatBubble
          body={order.description}
          attachmentIds={order.attachmentIds}
          urlById={urlById}
          createdAt={order.createdAt}
          mine={role === 'customer'}
        />

        {messages === undefined && (
          <div className="text-hint mt-4 text-center text-xs">Загрузка диалога…</div>
        )}

        {messages?.map((m) =>
          m.senderRole === 'system' ? (
            <SystemEvent key={m._id} body={m.body} createdAt={m.createdAt} />
          ) : (
            <ChatBubble
              key={m._id}
              body={m.body}
              attachmentIds={m.attachmentIds}
              urlById={urlById}
              createdAt={m.createdAt}
              mine={m.mine}
            />
          ),
        )}
      </div>

      {/* Action bar: status-driven action card + composer, both pinned to
       *  the viewport bottom. `shrink-0` keeps them out of the flex-grow
       *  share so the timeline above is the only thing that scrolls — the
       *  Telegram / WhatsApp pattern. */}
      {showActionBar && (
        <div className="border-separator bg-background shrink-0 border-t">
          {action && <div className="px-4 pt-3 pb-1">{action}</div>}
          {composerEnabled && <Composer onSend={submitMessage} />}
        </div>
      )}
    </div>
  )
}

// ─── chat bubble ─────────────────────────────────────────────────────────
function ChatBubble({
  body,
  attachmentIds,
  urlById,
  createdAt,
  mine,
}: {
  body: string
  attachmentIds: Id<'_storage'>[]
  urlById: AttachmentMap
  createdAt: number
  mine: boolean
}) {
  // Images render inline (top of the bubble); everything else as a clickable
  // pill row. Keeps the layout readable when an order's intro bubble has
  // both a long description and a screenshot attached.
  const images: { id: Id<'_storage'>; url: string }[] = []
  const others: {
    id: Id<'_storage'>
    url: string | null
    resolving: boolean
    contentType: string | null
  }[] = []
  for (const id of attachmentIds) {
    const resolved = urlById.get(id)
    const resolving = !urlById.has(id)
    if (resolved?.url && isImage(resolved.contentType)) {
      images.push({ id, url: resolved.url })
    } else {
      others.push({
        id,
        url: resolved?.url ?? null,
        resolving,
        contentType: resolved?.contentType ?? null,
      })
    }
  }

  return (
    <div className={cn('mt-2 flex w-full', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] overflow-hidden text-[15px] leading-snug',
          // Preserve user-entered newlines (pre-wrap) AND break long
          // unbroken strings (URLs, random ids) at character boundaries —
          // otherwise they overflow the bubble's max-width because the
          // browser has no whitespace to wrap on.
          'break-words whitespace-pre-wrap',
          'rounded-2xl',
          mine
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-secondary text-foreground rounded-bl-md',
        )}
      >
        {images.length > 0 && (
          <div className={cn('flex flex-col gap-px', body || others.length > 0 ? '' : '')}>
            {images.map((img) => (
              <ChatImage key={img.id} url={img.url} />
            ))}
          </div>
        )}
        <div className={cn('px-3.5', images.length > 0 ? 'pt-2 pb-2.5' : 'py-2.5')}>
          {body && <div>{body}</div>}
          {others.length > 0 && (
            <div className={cn('flex flex-col gap-1', body ? 'mt-2' : '')}>
              {others.map((a, i) => (
                <FilePill
                  key={a.id}
                  index={i + 1}
                  url={a.url}
                  resolving={a.resolving}
                  contentType={a.contentType}
                  mine={mine}
                />
              ))}
            </div>
          )}
          <div
            className={cn(
              'mt-1 text-right text-[10.5px] tabular-nums',
              mine ? 'text-primary-foreground/70' : 'text-hint',
            )}
          >
            {formatChatTimestamp(createdAt)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── inline image attachment ─────────────────────────────────────────────
function ChatImage({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage urls are dynamic; not in next.config remotePatterns */}
      <img
        src={url}
        alt=""
        loading="lazy"
        className="block h-auto max-h-[320px] w-full object-cover"
      />
    </a>
  )
}

// ─── file (non-image) attachment ─────────────────────────────────────────
function FilePill({
  index,
  url,
  resolving,
  contentType,
  mine,
}: {
  index: number
  url: string | null
  resolving: boolean
  contentType: string | null
  mine: boolean
}) {
  const ext = extensionFromContentType(contentType)
  const label = resolving
    ? 'Загрузка…'
    : url === null
      ? 'Файл недоступен'
      : ext
        ? `Файл ${index}.${ext.toLowerCase()}`
        : `Файл ${index}`
  const baseClass = cn(
    'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold',
    mine ? 'text-primary-foreground bg-white/15' : 'bg-background/70 text-foreground',
    (!url || resolving) && 'opacity-70',
  )
  if (!url) {
    return (
      <span className={baseClass}>
        <Paperclip className="size-3.5" />
        {label}
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(baseClass, 'transition-opacity active:opacity-80')}
    >
      <Paperclip className="size-3.5" />
      <span className="flex-1">{label}</span>
    </a>
  )
}

// ─── system event ────────────────────────────────────────────────────────
function SystemEvent({ body, createdAt }: { body: string; createdAt: number }) {
  return (
    <div className="my-3 flex justify-center">
      <div
        className="bg-secondary/70 text-text-soft inline-flex max-w-[85%] items-center gap-2
          rounded-full px-3 py-1 text-[11.5px] font-medium"
      >
        <span className="text-hint tabular-nums">{formatChatTimestamp(createdAt)}</span>
        <span className="bg-hint/40 size-0.5 rounded-full" />
        <span className="truncate">{body}</span>
      </div>
    </div>
  )
}

// ─── composer ────────────────────────────────────────────────────────────
interface StagedAttachment {
  key: string
  name: string
  previewUrl: string | null
  uploaded: UploadedFile | null
  error: string | null
}

/** Cap the auto-growing composer at ~5 lines; longer messages scroll inside. */
const COMPOSER_MAX_HEIGHT = 140

function Composer({
  onSend,
}: {
  onSend: (body: string, attachmentIds: Id<'_storage'>[]) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [staged, setStaged] = useState<StagedAttachment[]>([])
  const [pickerError, setPickerError] = useState<string | null>(null)
  const { upload, uploading, error: uploadError } = useUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea to fit content, capped at COMPOSER_MAX_HEIGHT. Reset
  // to `auto` first so `scrollHeight` reflects the natural content height
  // rather than the previously-set inline height.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`
  }, [draft])

  // Revoke any outstanding blob URLs on unmount.
  useEffect(
    () => () => {
      for (const s of staged) if (s.previewUrl) URL.revokeObjectURL(s.previewUrl)
    },
    // We only need the cleanup on unmount, not on every staged change — each
    // remove already revokes its own URL inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  async function handlePick(list: FileList) {
    const remaining = MAX_ATTACHMENTS - staged.length
    if (remaining <= 0) {
      setPickerError(`Максимум ${MAX_ATTACHMENTS} вложений`)
      return
    }

    const incoming = Array.from(list).slice(0, remaining)
    const accepted: { file: File; entry: StagedAttachment }[] = []
    let rejectNote: string | null = null

    for (const file of incoming) {
      const check = validateFile(file)
      if (!check.ok) {
        rejectNote = check.reason
        continue
      }
      const entry: StagedAttachment = {
        key: cryptoRandomId(),
        name: file.name,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        uploaded: null,
        error: null,
      }
      accepted.push({ file, entry })
    }

    setPickerError(rejectNote)
    if (accepted.length === 0) return

    setStaged((s) => [...s, ...accepted.map((a) => a.entry)])

    // Upload all in parallel; each completion patches its own slot.
    await Promise.all(
      accepted.map(async ({ file, entry }) => {
        const result = await upload(file)
        setStaged((s) =>
          s.map((x) =>
            x.key === entry.key
              ? {
                  ...x,
                  uploaded: result,
                  error: result ? null : 'Не удалось загрузить',
                }
              : x,
          ),
        )
      }),
    )
  }

  function removeStaged(key: string) {
    setStaged((s) => {
      const item = s.find((x) => x.key === key)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return s.filter((x) => x.key !== key)
    })
  }

  const trimmed = draft.trim()
  const readyIds = staged
    .map((s) => s.uploaded?.id)
    .filter((id): id is Id<'_storage'> => Boolean(id))
  const hasContent = trimmed.length > 0 || readyIds.length > 0
  const canSend = hasContent && !sending && !uploading

  async function submit() {
    if (!canSend) return
    setSending(true)
    setSendError(null)
    try {
      await onSend(trimmed, readyIds)
      setDraft('')
      for (const s of staged) if (s.previewUrl) URL.revokeObjectURL(s.previewUrl)
      setStaged([])
      setPickerError(null)
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  const showStagedRow = staged.length > 0
  // Surface the most recent error: a failed send takes priority because it
  // means the user's last explicit action didn't go through.
  const errorLine = sendError ?? pickerError ?? uploadError

  return (
    // `border-t` / `bg-background` are intentionally NOT here — the parent
    // action-bar wrapper owns the visual frame so the action card and the
    // composer read as one bottom region instead of two stacked panels.
    <div className="pb-[max(env(safe-area-inset-bottom),0.25rem)]">
      {showStagedRow && (
        <div
          className="flex gap-2 overflow-x-auto px-3 pt-2.5 pb-1 [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden"
        >
          {staged.map((s) => (
            <StagedThumb key={s.key} item={s} onRemove={() => removeStaged(s.key)} />
          ))}
        </div>
      )}

      {errorLine && <div className="text-status-fail px-4 pt-1 text-[12px]">{errorLine}</div>}

      <div className="flex items-end gap-1 px-2 py-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || staged.length >= MAX_ATTACHMENTS}
          aria-label="Прикрепить файл"
          className="text-text-soft flex size-10 shrink-0 items-center justify-center rounded-full
            transition-opacity active:opacity-70 disabled:opacity-40"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Paperclip className="size-5" strokeWidth={1.8} />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handlePick(e.target.files)
            // Allow picking the same file twice in a row.
            e.target.value = ''
          }}
        />

        {/* `min-h-10` matches the buttons' 40px so single-line state lines
         *  up neatly; `items-center` keeps the textarea vertically centered
         *  inside the rounded rect. When the textarea auto-grows multi-line,
         *  the wrapper grows with it, and the outer row's `items-end` keeps
         *  the paperclip/send buttons pinned to the bottom corners — the
         *  standard chat-app pattern. */}
        <div
          className="bg-secondary flex min-h-10 min-w-0 flex-1 items-center rounded-2xl px-3.5
            py-1.5"
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
            placeholder="Сообщение…"
            rows={1}
            className="text-foreground placeholder:text-hint block w-full resize-none bg-transparent
              text-[15px] leading-snug outline-none"
            style={{ maxHeight: COMPOSER_MAX_HEIGHT }}
          />
        </div>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Отправить"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full transition-opacity',
            canSend ? 'bg-primary text-primary-foreground' : 'bg-secondary text-hint',
            sending && 'opacity-60',
          )}
        >
          {sending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <SendHorizontal className="size-5" strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  )
}

function StagedThumb({ item, onRemove }: { item: StagedAttachment; onRemove: () => void }) {
  const isUploading = item.uploaded === null && item.error === null
  const errored = item.error !== null
  const ext = getFileExtension(item.name).toUpperCase()
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          'bg-secondary flex size-16 items-center justify-center overflow-hidden rounded-xl',
          errored && 'ring-status-fail/40 ring-2',
        )}
      >
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob:// preview, not optimisable
          <img src={item.previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-0.5 px-1 text-center">
            <span className="text-foreground text-[10px] font-bold tracking-wide">
              {ext || 'FILE'}
            </span>
            <span className="text-hint w-full truncate text-[10px]">{item.name}</span>
          </div>
        )}
        {isUploading && (
          <div className="bg-background/60 absolute inset-0 flex items-center justify-center">
            <Loader2 className="text-primary size-5 animate-spin" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Убрать"
        className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5
          items-center justify-center rounded-full shadow"
      >
        <X className="size-3" strokeWidth={2.5} />
      </button>
    </div>
  )
}

// `crypto.randomUUID()` is available in all our target browsers; fall back to
// a fast non-cryptographic id just in case.
function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
