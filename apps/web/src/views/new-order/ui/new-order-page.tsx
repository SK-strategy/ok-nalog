'use client'

import { useSearchParams } from 'next/navigation'

import type { ClientType } from '@tax-assistant/validators'
import { CLIENT_TYPES } from '@tax-assistant/validators'

import { AuthGate } from '~/features/auth'
import { NewQuestionForm, useNewQuestionForm } from '~/features/create-order'
import type { Id } from '~/shared/api'

const isClientType = (v: string | null): v is ClientType =>
  v !== null && (CLIENT_TYPES as readonly string[]).includes(v)

/**
 * /orders/new — new question form. `?categoryId=X` prefills (entered via a
 * specific category tile); no `?categoryId` restores the saved draft.
 */
export function NewOrderPage() {
  const sp = useSearchParams()
  const initialCategoryId = (sp.get('categoryId') as Id<'categories'> | null) ?? undefined
  const ctParam = sp.get('clientType')
  const clientType = isClientType(ctParam) ? ctParam : undefined

  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-12 sm:px-6">
      <h1 className="text-foreground text-2xl leading-tight font-bold tracking-tight">
        Новое обращение
      </h1>
      <AuthGate>
        <FormShell initialCategoryId={initialCategoryId} clientType={clientType} />
      </AuthGate>
    </main>
  )
}

function FormShell({
  initialCategoryId,
  clientType,
}: {
  initialCategoryId?: Id<'categories'>
  clientType?: ClientType
}) {
  const form = useNewQuestionForm({ initialCategoryId, clientType })
  return <NewQuestionForm form={form} clientType={clientType} />
}
