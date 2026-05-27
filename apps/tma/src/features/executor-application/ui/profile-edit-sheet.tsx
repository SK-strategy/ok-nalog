'use client'

import { Button } from '@tax-assistant/ui/button'

import { BottomSheet } from '~/shared/ui/bottom-sheet'

import type { ExecutorApplicationInitial } from '../model/use-executor-application'
import { useExecutorApplication } from '../model/use-executor-application'
import { ExecutorApplicationForm } from './executor-application-form'

interface ProfileEditSheetProps {
  open: boolean
  initial?: ExecutorApplicationInitial
  onClose: () => void
}

/**
 * Bottom-sheet wrapper for the executor анкета. Used by the cabinet so an
 * approved expert (or one waiting for review) can update their анкета
 * without leaving the screen. The button lives here, not in the form, so
 * the form view can be reused on the apply screen where Telegram's
 * MainButton owns the submit affordance.
 */
export function ProfileEditSheet({ open, initial, onClose }: ProfileEditSheetProps) {
  const form = useExecutorApplication({ initial, onSubmitted: onClose })
  if (!open) return null
  return (
    <BottomSheet title="Анкета" onClose={onClose}>
      <div className="flex max-h-[80vh] flex-col">
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">
          <ExecutorApplicationForm form={form} />
        </div>
        <div className="border-separator bg-background border-t px-4 pt-3 pb-4">
          <Button className="w-full" disabled={!form.canSubmit} onClick={() => void form.submit()}>
            {form.submitting ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
