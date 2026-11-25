import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getLegalDocument, LegalDocumentPage } from '~/views/legal'

const doc = getLegalDocument('oplata')

export const metadata: Metadata = {
  title: 'Правила оплаты и возврата — ОК, налог.нет',
}

export default function Page() {
  if (!doc) notFound()
  return <LegalDocumentPage doc={doc} />
}
