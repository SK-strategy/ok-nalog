import type { Metadata } from 'next'

import { MarketingPage } from '~/views/marketing'
import { SiteFooter } from '~/widgets/site-footer'

// Landing metadata lives here (brief §8), not in the root layout — the layout
// keeps the product's title/description for /orders and the cabinets.
export const metadata: Metadata = {
  title: 'Налоговая экспертиза от экс-заместителя руководителя УФНС — разбор требований и защита',
  description:
    'Загрузите документ из налоговой — эксперты контрольных подразделений ФНС дадут ' +
    'расшифровку, готовый ответ и прогноз. 300 лет совокупного опыта.',
}

export default function LandingPage() {
  return (
    <>
      <MarketingPage />
      <SiteFooter />
    </>
  )
}
