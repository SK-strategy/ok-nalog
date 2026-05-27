'use client'

import { BottomSheet } from '~/shared/ui/bottom-sheet'

import type { ExecutorApplicationInitial } from './executor-application-form'
import { ExecutorApplicationForm } from './executor-application-form'

interface ProfileEditSheetProps {
  open: boolean
  initial?: ExecutorApplicationInitial
  onClose: () => void
}

/**
 * Bottom-sheet wrapper for the executor anketa form. Used from the executor
 * cabinet so an approved expert can update categories / bio / qualifications
 * without leaving the screen. Closes itself once `apply` succeeds.
 */
export function ProfileEditSheet({ open, initial, onClose }: ProfileEditSheetProps) {
  if (!open) return null
  return (
    <BottomSheet title="Анкета" onClose={onClose}>
      <div className="overflow-y-auto px-4 pt-2 pb-6">
        <ExecutorApplicationForm initial={initial} submitLabel="Сохранить" onSubmitted={onClose} />
      </div>
    </BottomSheet>
  )
}
