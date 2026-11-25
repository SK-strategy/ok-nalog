import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getLegalDocument, LegalDocumentPage } from '~/views/legal'

const doc = getLegalDocument('politika')

export const metadata: Metadata = {
  title: 'Политика конфиденциальности — ОК, налог.нет',
}

export default function Page() {
  if (!doc) notFound()
  return <LegalDocumentPage doc={doc} />
}
