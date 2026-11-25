/**
 * Registry of legal documents. Each entry maps a route slug to a GFM markdown
 * file in `../content/` (converted from the lawyer's docx via pandoc).
 */
export interface LegalDocument {
  slug: string
  title: string
  file: string
}

export const LEGAL_DOCUMENTS = [
  { slug: 'oferta', title: 'Пользовательское соглашение', file: 'oferta.md' },
  { slug: 'politika', title: 'Политика конфиденциальности', file: 'politika.md' },
  {
    slug: 'politika-pd',
    title: 'Политика обработки персональных данных',
    file: 'politika-pd.md',
  },
  {
    slug: 'soglasie',
    title: 'Согласие на обработку персональных данных',
    file: 'soglasie.md',
  },
  { slug: 'oplata', title: 'Правила оплаты и возврата', file: 'oplata.md' },
  { slug: 'tarify', title: 'Тарифы и сроки ответов', file: 'tarify.md' },
  { slug: 'cookie', title: 'Уведомление о cookie и настройки', file: 'cookie.md' },
  {
    slug: 'dogovor-ekspertov',
    title: 'Договор и правила для экспертов',
    file: 'dogovor-ekspertov.md',
  },
] as const satisfies readonly LegalDocument[]

export type LegalDocumentSlug = (typeof LEGAL_DOCUMENTS)[number]['slug']

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.slug === slug)
}
