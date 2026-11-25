import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getLegalDocument, LegalDocumentPage } from '~/views/legal'

const doc = getLegalDocument('tarify')

export const metadata: Metadata = {
  title: 'Тарифы и сроки ответов — ОК, налог.нет',
}

export default function Page() {
  if (!doc) notFound()
  return <LegalDocumentPage doc={doc} />
}
