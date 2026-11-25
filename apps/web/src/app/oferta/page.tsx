import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getLegalDocument, LegalDocumentPage } from '~/views/legal'

const doc = getLegalDocument('oferta')

export const metadata: Metadata = {
  title: 'Пользовательское соглашение — ОК, налог.нет',
}

export default function Page() {
  if (!doc) notFound()
  return <LegalDocumentPage doc={doc} />
}
