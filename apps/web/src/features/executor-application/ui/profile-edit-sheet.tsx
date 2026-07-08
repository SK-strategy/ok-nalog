'use client'

import { Button } from '@tax-assistant/ui/button'

import { Modal } from '~/shared/ui/modal'

import type { ExecutorApplicationInitial } from '../model/use-executor-application'
import { useExecutorApplication } from '../model/use-executor-application'
import { ExecutorApplicationForm } from './executor-application-form'

interface ProfileEditSheetProps {
  open: boolean
  initial?: ExecutorApplicationInitial
  onClose: () => void
}

/**
 * Modal wrapper for the executor анкета — lets an approved (or pending)
 * expert update their анкета inline without leaving the cabinet.
 */
export function ProfileEditSheet({ open, initial, onClose }: ProfileEditSheetProps) {
  const form = useExecutorApplication({ initial, onSubmitted: onClose })
  return (
    <Modal open={open} onClose={onClose} title="Анкета">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <ExecutorApplicationForm form={form} />
        </div>
        <div className="border-separator bg-background shrink-0 border-t px-5 pt-3 pb-5">
          <Button className="w-full" disabled={!form.canSubmit} onClick={() => void form.submit()}>
            {form.submitting ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
