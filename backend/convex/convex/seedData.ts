// Seed data for the catalogue. Mirrors `tmp/tax_tags_seed.json`. Imported by
// `seed.run` which idempotently upserts categories + tags by `code`.

import type { ClientType } from '@tax-assistant/validators'

export interface CategorySeed {
  code: string
  title: string
  description: string
  /** Default базовая стоимость in kopecks for tile pricing. */
  basePrice: number
  sortOrder: number
  clientTypes: ClientType[]
}

export interface TagSeed {
  name: string
  categoryCode: string
  clientTypes: ClientType[]
}

// Reasonable starting base prices in kopecks (₽3 000 baseline, scaled per
// thematic weight). The admin can tune these later in the dashboard.
const RUB = 100
const BASE = 3000 * RUB

export const CATEGORIES_SEED: CategorySeed[] = [
  {
    code: 'tax_audits',
    title: 'Налоговые проверки',
    description: 'Камеральные и выездные проверки, акты, обжалование',
    basePrice: 7000 * RUB,
    sortOrder: 10,
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    code: 'main_taxes',
    title: 'Основные налоги',
    description: 'НДС, налог на прибыль, НДФЛ и другие федеральные налоги',
    basePrice: 5000 * RUB,
    sortOrder: 20,
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    code: 'special_regimes',
    title: 'Спецрежимы',
    description: 'УСН, АУСН, ПСН, ЕСХН, НПД',
    basePrice: 4500 * RUB,
    sortOrder: 30,
    clientTypes: ['legal_entity_ie', 'npd_payer'],
  },
  {
    code: 'property_taxes',
    title: 'Имущественные налоги',
    description: 'Налог на имущество, транспортный, земельный налог',
    basePrice: BASE,
    sortOrder: 40,
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    code: 'resource_taxes',
    title: 'Ресурсные налоги и акцизы',
    description: 'НДПИ, водный налог, акцизы, сборы',
    basePrice: 6000 * RUB,
    sortOrder: 50,
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'reporting',
    title: 'Отчётность и взносы',
    description: '6-НДФЛ, страховые взносы, бухгалтерская отчётность',
    basePrice: 4000 * RUB,
    sortOrder: 60,
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'tax_authority_interaction',
    title: 'Взаимодействие с налоговой',
    description: 'Вызовы, требования, истребование документов, допросы',
    basePrice: 5000 * RUB,
    sortOrder: 70,
    clientTypes: ['legal_entity_ie', 'individual', 'npd_payer'],
  },
  {
    code: 'enforcement',
    title: 'Принудительные меры и взыскание',
    description: 'Приостановление операций по счетам, банкротство, задолженность',
    basePrice: 8000 * RUB,
    sortOrder: 80,
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    code: 'registration',
    title: 'Регистрационные действия',
    description: 'Регистрация, ликвидация, достоверность сведений в ЕГРЮЛ/ЕГРНИП',
    basePrice: 4500 * RUB,
    sortOrder: 90,
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'other',
    title: 'Прочее',
    description: 'ККТ, РСМП, ЕНС, оптимизация налогообложения',
    basePrice: BASE,
    sortOrder: 100,
    clientTypes: ['legal_entity_ie', 'individual', 'npd_payer'],
  },
]

export const TAGS_SEED: TagSeed[] = [
  // tax_audits
  {
    name: 'Камеральная налоговая проверка',
    categoryCode: 'tax_audits',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Выездная налоговая проверка',
    categoryCode: 'tax_audits',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Налоговая проверка',
    categoryCode: 'tax_audits',
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    name: 'Акт проверки',
    categoryCode: 'tax_audits',
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    name: 'Контрольно-аналитический отдел (КАО)',
    categoryCode: 'tax_audits',
    clientTypes: ['legal_entity_ie'],
  },
  // main_taxes
  {
    name: 'НДС',
    categoryCode: 'main_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Налог на прибыль',
    categoryCode: 'main_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: '3-НДФЛ',
    categoryCode: 'main_taxes',
    clientTypes: ['individual'],
  },
  // reporting
  {
    name: '6-НДФЛ',
    categoryCode: 'reporting',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Страховые взносы',
    categoryCode: 'reporting',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Бухгалтерская отчётность',
    categoryCode: 'reporting',
    clientTypes: ['legal_entity_ie'],
  },
  // special_regimes
  {
    name: 'УСН',
    categoryCode: 'special_regimes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'АУСН',
    categoryCode: 'special_regimes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Патентная система налогообложения',
    categoryCode: 'special_regimes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'ЕСХН',
    categoryCode: 'special_regimes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'НПД (Налог на профессиональный доход)',
    categoryCode: 'special_regimes',
    clientTypes: ['legal_entity_ie', 'npd_payer'],
  },
  // property_taxes
  {
    name: 'Налог на имущество ЮЛ',
    categoryCode: 'property_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Транспортный налог ЮЛ',
    categoryCode: 'property_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Земельный налог ЮЛ',
    categoryCode: 'property_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Имущественные налоги ФЛ',
    categoryCode: 'property_taxes',
    clientTypes: ['individual'],
  },
  {
    name: 'Сводное налоговое уведомление',
    categoryCode: 'property_taxes',
    clientTypes: ['individual'],
  },
  // resource_taxes
  {
    name: 'Акцизы',
    categoryCode: 'resource_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'НДПИ',
    categoryCode: 'resource_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Водный налог',
    categoryCode: 'resource_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Животный мир, водные биологические ресурсы',
    categoryCode: 'resource_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  // tax_authority_interaction
  {
    name: 'Вызов в налоговый орган',
    categoryCode: 'tax_authority_interaction',
    clientTypes: ['legal_entity_ie', 'individual', 'npd_payer'],
  },
  {
    name: 'Требование о представлении пояснений',
    categoryCode: 'tax_authority_interaction',
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    name: 'Вызов на допрос',
    categoryCode: 'tax_authority_interaction',
    clientTypes: ['legal_entity_ie', 'individual', 'npd_payer'],
  },
  {
    name: 'Истребование документов',
    categoryCode: 'tax_authority_interaction',
    clientTypes: ['legal_entity_ie'],
  },
  // enforcement
  {
    name: 'Приостановление операций по счетам',
    categoryCode: 'enforcement',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Административное производство',
    categoryCode: 'enforcement',
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    name: 'Банкротство',
    categoryCode: 'enforcement',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Задолженность',
    categoryCode: 'enforcement',
    clientTypes: ['legal_entity_ie'],
  },
  // registration
  {
    name: 'Регистрация',
    categoryCode: 'registration',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Ликвидация',
    categoryCode: 'registration',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Достоверность ЕГРЮЛ',
    categoryCode: 'registration',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Достоверность ЕГРНИП',
    categoryCode: 'registration',
    clientTypes: ['legal_entity_ie'],
  },
  // other
  {
    name: 'ЕНС (Единый налоговый счёт)',
    categoryCode: 'other',
    clientTypes: ['legal_entity_ie', 'individual', 'npd_payer'],
  },
  {
    name: 'ККТ (Контрольно-кассовая техника)',
    categoryCode: 'other',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'РСМП (Реестр субъектов малого и среднего предпринимательства)',
    categoryCode: 'other',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Оптимизация налогообложения',
    categoryCode: 'other',
    clientTypes: ['legal_entity_ie'],
  },
  {
    name: 'Вопросы по приложению',
    categoryCode: 'other',
    clientTypes: ['npd_payer'],
  },
]
