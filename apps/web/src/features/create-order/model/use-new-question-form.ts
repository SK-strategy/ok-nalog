'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConvex, useMutation, useQuery } from 'convex/react'

import type { ClientType } from '@tax-assistant/validators'
import { MAX_ATTACHMENTS } from '@tax-assistant/validators'

import type { Doc, Id } from '~/shared/api'
import type { UploadedFile } from '~/shared/lib/use-upload'
import { api } from '~/shared/api'
import { useUpload, validateFile } from '~/shared/lib/use-upload'

import { useDebouncedEffect } from '../lib/use-debounced-effect'

type Category = Doc<'categories'>

const MIN_CHARS = 30
const MAX_CHARS = 5000
const DRAFT_DEBOUNCE_MS = 700

export interface NewQuestionFormController {
  readonly minChars: number
  readonly maxChars: number
  readonly maxAttachments: number

  readonly category: Category | undefined
  categoryId: Id<'categories'> | undefined
  setCategoryId: (id: Id<'categories'> | undefined) => void
  readonly categoriesLoading: boolean

  readonly tags: Doc<'tags'>[] | undefined
  readonly hasDraft: boolean

  description: string
  setDescription: (v: string) => void
  tagId: Id<'tags'> | undefined
  setTagId: (v: Id<'tags'> | undefined) => void

  files: UploadedFile[]
  addFiles: (list: FileList) => Promise<void>
  removeFile: (id: UploadedFile['id']) => void
  uploading: boolean
  uploadError: string | null

  canSubmit: boolean
  submitting: boolean
  submit: () => Promise<void>
  error: string | null
}

/**
 * All state, server-sync and submission logic for the new-question form.
 * See the TMA copy at apps/tma/src/features/create-order/model — intentional
 * duplicate per the per-app FSD pattern (surfaces differ: web uses an inline
 * submit button instead of the Telegram MainButton).
 */
export function useNewQuestionForm({
  initialCategoryId,
  clientType,
}: {
  initialCategoryId?: Id<'categories'>
  clientType?: ClientType
}): NewQuestionFormController {
  const router = useRouter()
  const convex = useConvex()

  const create = useMutation(api.orders.create)
  const upsertDraft = useMutation(api.drafts.upsert)
  const clearDraft = useMutation(api.drafts.clear)
  const draft = useQuery(api.drafts.myDraft, {})
  const categories = useQuery(api.categories.listActive, {})

  const [categoryId, setCategoryIdState] = useState<Id<'categories'> | undefined>(initialCategoryId)
  const [description, setDescriptionState] = useState('')
  const [tagId, setTagIdState] = useState<Id<'tags'> | undefined>(undefined)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localUploadError, setLocalUploadError] = useState<string | null>(null)

  const category = useMemo(
    () => (categoryId ? categories?.find((c) => c._id === categoryId) : undefined),
    [categories, categoryId],
  )

  const tags = useQuery(
    api.tags.listByCategoryAndType,
    categoryId ? { categoryId, clientType } : 'skip',
  )

  const setDescription = useCallback((v: string) => {
    setDescriptionState(v.slice(0, MAX_CHARS))
  }, [])

  const setCategoryId = useCallback((next: Id<'categories'> | undefined) => {
    setCategoryIdState((prev) => {
      if (prev !== next) setTagIdState(undefined)
      return next
    })
  }, [])

  const hydrateFiles = useCallback(
    async (ids: Id<'_storage'>[]): Promise<UploadedFile[]> => {
      try {
        const rows = await convex.query(api.files.getUrls, { ids })
        return rows.map((r, i) => ({
          id: r.id,
          name: `Файл ${i + 1}`,
          size: 0,
          type: r.url?.includes('image') ? 'image/*' : 'application/octet-stream',
        }))
      } catch {
        return []
      }
    },
    [convex],
  )

  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    if (draft === undefined) return
    hydratedRef.current = true
    if (initialCategoryId !== undefined) return
    if (!draft) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDescriptionState(draft.description)
    if (draft.categoryId) setCategoryIdState(draft.categoryId)
    if (draft.tagId) setTagIdState(draft.tagId)
    if (draft.attachmentIds.length > 0) {
      void hydrateFiles(draft.attachmentIds).then(setFiles)
    }
  }, [draft, initialCategoryId, hydrateFiles])

  const { upload, uploading, error: uploadErr } = useUpload()

  const addFiles = useCallback(
    async (list: FileList) => {
      setLocalUploadError(null)
      const slots = MAX_ATTACHMENTS - files.length
      const incoming = Array.from(list).slice(0, slots)
      const accepted: UploadedFile[] = []
      let lastReject: string | null = null
      for (const f of incoming) {
        const check = validateFile(f)
        if (!check.ok) {
          lastReject = check.reason
          continue
        }
        const uploaded = await upload(f)
        if (uploaded) accepted.push(uploaded)
      }
      if (lastReject) setLocalUploadError(lastReject)
      if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted])
    },
    [files.length, upload],
  )

  const removeFile = useCallback(
    (id: UploadedFile['id']) => setFiles((prev) => prev.filter((f) => f.id !== id)),
    [],
  )

  const attachmentIds = useMemo(() => files.map((f) => f.id), [files])

  useDebouncedEffect(
    () => {
      if (submitting) return
      if (
        description.length === 0 &&
        tagId === undefined &&
        attachmentIds.length === 0 &&
        categoryId === undefined
      )
        return
      void upsertDraft({
        categoryId,
        tagId,
        clientType,
        description,
        attachmentIds,
      })
    },
    [description, tagId, attachmentIds, categoryId, clientType, submitting, upsertDraft],
    DRAFT_DEBOUNCE_MS,
  )

  const trimmed = description.trim()
  const tooShort = trimmed.length < MIN_CHARS
  const canSubmit = !!categoryId && !tooShort && !submitting

  const submit = useCallback(async () => {
    if (!canSubmit || !categoryId) return
    setSubmitting(true)
    setError(null)
    try {
      const orderId = await create({
        categoryId,
        description: trimmed,
        attachmentIds,
        tagId,
        clientType,
      })
      await clearDraft({})
      router.replace(`/orders/${orderId}`)
    } catch {
      setError('Не удалось отправить обращение. Попробуйте ещё раз.')
      setSubmitting(false)
    }
  }, [canSubmit, create, categoryId, trimmed, attachmentIds, tagId, clientType, clearDraft, router])

  return {
    minChars: MIN_CHARS,
    maxChars: MAX_CHARS,
    maxAttachments: MAX_ATTACHMENTS,
    category,
    categoryId,
    setCategoryId,
    categoriesLoading: categories === undefined,
    tags,
    hasDraft: !!draft,
    description,
    setDescription,
    tagId,
    setTagId: setTagIdState,
    files,
    addFiles,
    removeFile,
    uploading,
    uploadError: localUploadError ?? uploadErr,
    canSubmit,
    submitting,
    submit,
    error,
  }
}
