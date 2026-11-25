import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getLegalDocument, LegalDocumentPage } from '~/views/legal'

const doc = getLegalDocument('dogovor-ekspertov')

export const metadata: Metadata = {
  title: 'Договор и правила для экспертов — ОК, налог.нет',
}

export default function Page() {
  if (!doc) notFound()
  return <LegalDocumentPage doc={doc} />
}
