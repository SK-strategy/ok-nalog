'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'

import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'

const MIN_NAME = 2
const MIN_BIO = 20
const MIN_QUALIFICATIONS = 10
const MAX_BIO = 600
const MAX_QUALIFICATIONS = 400

export interface ExecutorApplicationInitial {
  fullName: string
  bio: string
  qualifications: string
  categoryIds: Id<'categories'>[]
}

export interface ExecutorApplicationController {
  readonly minBio: number
  readonly maxBio: number
  readonly minQualifications: number
  readonly maxQualifications: number

  fullName: string
  setFullName: (v: string) => void
  bio: string
  setBio: (v: string) => void
  qualifications: string
  setQualifications: (v: string) => void

  readonly categories: Doc<'categories'>[] | undefined
  categoryIds: Id<'categories'>[]
  toggleCategory: (id: Id<'categories'>) => void

  canSubmit: boolean
  submitting: boolean
  submit: () => Promise<void>
  error: string | null
}

/**
 * All state + submission logic for the executor анкета. Lives separately from
 * the view so the same controller can drive both the first-time apply screen
 * (MainButton submit) and the approved-user edit sheet (inline button submit).
 *
 * Re-hydrates field state when `initial` changes by identity — the sheet opens
 * with a freshly-built `initial` object per session, and we want each open to
 * start from the latest saved анкета.
 */
export function useExecutorApplication({
  initial,
  onSubmitted,
}: {
  initial?: ExecutorApplicationInitial
  onSubmitted?: () => void
} = {}): ExecutorApplicationController {
  const { isAuthenticated } = useSession()
  const categories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')
  const apply = useMutation(api.executors.apply)

  const [fullName, setFullNameState] = useState(initial?.fullName ?? '')
  const [bio, setBioState] = useState(initial?.bio ?? '')
  const [qualifications, setQualificationsState] = useState(initial?.qualifications ?? '')
  const [categoryIds, setCategoryIds] = useState<Id<'categories'>[]>(initial?.categoryIds ?? [])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-hydrate when the parent swaps in a different анкета snapshot (e.g. the
  // edit sheet opens for a freshly loaded profile).
  const lastInitialRef = useRef(initial)
  useEffect(() => {
    if (initial === lastInitialRef.current) return
    lastInitialRef.current = initial
    if (!initial) return
    setFullNameState(initial.fullName)
    setBioState(initial.bio)
    setQualificationsState(initial.qualifications)
    setCategoryIds(initial.categoryIds)
  }, [initial])

  const setFullName = useCallback((v: string) => setFullNameState(v.slice(0, 80)), [])
  const setBio = useCallback((v: string) => setBioState(v.slice(0, MAX_BIO)), [])
  const setQualifications = useCallback(
    (v: string) => setQualificationsState(v.slice(0, MAX_QUALIFICATIONS)),
    [],
  )
  const toggleCategory = useCallback((id: Id<'categories'>) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const canSubmit =
    isAuthenticated &&
    !submitting &&
    fullName.trim().length >= MIN_NAME &&
    bio.trim().length >= MIN_BIO &&
    qualifications.trim().length >= MIN_QUALIFICATIONS &&
    categoryIds.length > 0

  const submit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await apply({
        fullName: fullName.trim(),
        bio: bio.trim(),
        qualifications: qualifications.trim(),
        categoryIds,
      })
      onSubmitted?.()
    } catch {
      setError('Не удалось отправить анкету. Попробуйте ещё раз.')
    } finally {
      setSubmitting(false)
    }
  }, [apply, bio, canSubmit, categoryIds, fullName, onSubmitted, qualifications])

  return {
    minBio: MIN_BIO,
    maxBio: MAX_BIO,
    minQualifications: MIN_QUALIFICATIONS,
    maxQualifications: MAX_QUALIFICATIONS,
    fullName,
    setFullName,
    bio,
    setBio,
    qualifications,
    setQualifications,
    categories,
    categoryIds,
    toggleCategory,
    canSubmit,
    submitting,
    submit,
    error,
  }
}
