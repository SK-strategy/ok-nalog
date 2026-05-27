'use client'

import { useSearchParams } from 'next/navigation'

import type { ClientType } from '@tax-assistant/validators'
import { CLIENT_TYPES } from '@tax-assistant/validators'

import { TmaScreen } from '~/widgets/tma-shell'
import { NewQuestionForm, useNewQuestionForm } from '~/features/create-order'
import type { Id } from '~/shared/api'

const isClientType = (v: string | null): v is ClientType =>
  v !== null && (CLIENT_TYPES as readonly string[]).includes(v)

/**
 * /orders/new — a single screen with an inline category selector at the top.
 *
 *   - `?categoryId=X` (clicked a tile or search result on home) → prefills.
 *   - no `?categoryId` ("Перейти к черновику" or "+ Новое обращение" with no
 *     tile) → starts empty, or restores the saved draft if one exists.
 *
 * `?clientType` is forwarded from home to filter the category/tag pickers.
 */
export function NewOrderPage() {
  const sp = useSearchParams()
  const initialCategoryId = (sp.get('categoryId') as Id<'categories'> | null) ?? undefined
  const ctParam = sp.get('clientType')
  const clientType = isClientType(ctParam) ? ctParam : undefined

  return <FormScreen initialCategoryId={initialCategoryId} clientType={clientType} />
}

// The MainButton wiring lives here, in the view layer, so the feature stays
// FSD-clean (features cannot import from widgets). The form controller hook
// owns all state and submission logic.
function FormScreen({
  initialCategoryId,
  clientType,
}: {
  initialCategoryId?: Id<'categories'>
  clientType?: ClientType
}) {
  const form = useNewQuestionForm({ initialCategoryId, clientType })
  return (
    <TmaScreen
      title="Новое обращение"
      subtitle={form.category?.title ?? 'Выберите категорию'}
      mainButton={{
        text: 'Отправить',
        onClick: () => void form.submit(),
        disabled: !form.canSubmit,
        loading: form.submitting,
      }}
    >
      <NewQuestionForm form={form} clientType={clientType} />
    </TmaScreen>
  )
}
