import type { Metadata } from 'next'

import { FAQ, MarketingPage } from '~/views/marketing'
import { SiteFooter } from '~/widgets/site-footer'

// Landing metadata lives here (brief §8), not in the root layout — the layout
// keeps the product's title/description for /orders and the cabinets.
export const metadata: Metadata = {
  title: 'Налоговая экспертиза от экс-заместителя руководителя УФНС — разбор требований и защита',
  description:
    'Загрузите документ из налоговой — эксперты контрольных подразделений ФНС дадут ' +
    'расшифровку, готовый ответ и прогноз. 300 лет совокупного опыта.',
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      'name': 'ОК, налог.нет',
      'url': 'https://oknalog.net',
    },
    {
      '@type': 'Service',
      'name': 'Налоговая экспертиза',
      'provider': { '@type': 'Organization', 'name': 'ОК, налог.нет' },
      'areaServed': 'RU',
      'description':
        'Разбор требований и документов из налоговой экспертами контрольных подразделений ФНС.',
    },
    {
      '@type': 'FAQPage',
      'mainEntity': FAQ.map((item) => ({
        '@type': 'Question',
        'name': item.q,
        'acceptedAnswer': { '@type': 'Answer', 'text': item.a },
      })),
    },
  ],
}

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <MarketingPage />
      <SiteFooter />
    </>
  )
}
