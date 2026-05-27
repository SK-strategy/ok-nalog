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
  code: string
  name: string
  specialistCode: string | null
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
    code: 'kameralnaya_proverka',
    name: 'Камеральная налоговая проверка',
    specialistCode: 'КНП',
    categoryCode: 'tax_audits',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'vyezdnaya_proverka',
    name: 'Выездная налоговая проверка',
    specialistCode: 'ВНП',
    categoryCode: 'tax_audits',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'nalogovaya_proverka',
    name: 'Налоговая проверка',
    specialistCode: null,
    categoryCode: 'tax_audits',
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    code: 'akt_proverki',
    name: 'Акт проверки',
    specialistCode: null,
    categoryCode: 'tax_audits',
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    code: 'kao',
    name: 'Контрольно-аналитический отдел (КАО)',
    specialistCode: 'КАО',
    categoryCode: 'tax_audits',
    clientTypes: ['legal_entity_ie'],
  },
  // main_taxes
  {
    code: 'nds',
    name: 'НДС',
    specialistCode: 'НДС',
    categoryCode: 'main_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'nalog_na_pribyl',
    name: 'Налог на прибыль',
    specialistCode: 'Налог на прибыль',
    categoryCode: 'main_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'ndfl_3',
    name: '3-НДФЛ',
    specialistCode: '3НДФЛ',
    categoryCode: 'main_taxes',
    clientTypes: ['individual'],
  },
  // reporting
  {
    code: 'ndfl_6',
    name: '6-НДФЛ',
    specialistCode: '6НДФЛ',
    categoryCode: 'reporting',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'strahovye_vznosy',
    name: 'Страховые взносы',
    specialistCode: 'СВ',
    categoryCode: 'reporting',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'buh_otchetnost',
    name: 'Бухгалтерская отчётность',
    specialistCode: 'Бухгалтерская отчетность',
    categoryCode: 'reporting',
    clientTypes: ['legal_entity_ie'],
  },
  // special_regimes
  {
    code: 'usn',
    name: 'УСН',
    specialistCode: 'УСН/АУСН',
    categoryCode: 'special_regimes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'ausn',
    name: 'АУСН',
    specialistCode: 'УСН/АУСН',
    categoryCode: 'special_regimes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'patent',
    name: 'Патентная система налогообложения',
    specialistCode: 'Патент',
    categoryCode: 'special_regimes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'eshn',
    name: 'ЕСХН',
    specialistCode: 'ЕСХН',
    categoryCode: 'special_regimes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'npd',
    name: 'НПД (Налог на профессиональный доход)',
    specialistCode: 'НПД ЮЛ/НПД ФЛ',
    categoryCode: 'special_regimes',
    clientTypes: ['legal_entity_ie', 'npd_payer'],
  },
  // property_taxes
  {
    code: 'nalog_na_imuschestvo_ul',
    name: 'Налог на имущество ЮЛ',
    specialistCode: 'Имущественные налоги ЮЛ',
    categoryCode: 'property_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'transportnyy_nalog_ul',
    name: 'Транспортный налог ЮЛ',
    specialistCode: 'Имущественные налоги ЮЛ',
    categoryCode: 'property_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'zemelnyy_nalog_ul',
    name: 'Земельный налог ЮЛ',
    specialistCode: 'Имущественные налоги ЮЛ',
    categoryCode: 'property_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'imuschestvennye_nalogi_fl',
    name: 'Имущественные налоги ФЛ',
    specialistCode: 'Имущественные налоги ФЛ',
    categoryCode: 'property_taxes',
    clientTypes: ['individual'],
  },
  {
    code: 'svodnoe_nu',
    name: 'Сводное налоговое уведомление',
    specialistCode: 'СНУ',
    categoryCode: 'property_taxes',
    clientTypes: ['individual'],
  },
  // resource_taxes
  {
    code: 'akcizy',
    name: 'Акцизы',
    specialistCode: 'Акцизы',
    categoryCode: 'resource_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'ndpi',
    name: 'НДПИ',
    specialistCode: 'НДПИ',
    categoryCode: 'resource_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'vodnyy_nalog',
    name: 'Водный налог',
    specialistCode: 'Водный налог',
    categoryCode: 'resource_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'zhivotnyy_mir',
    name: 'Животный мир, водные биологические ресурсы',
    specialistCode: 'Животный мир, водные биологические ресурсы',
    categoryCode: 'resource_taxes',
    clientTypes: ['legal_entity_ie'],
  },
  // tax_authority_interaction
  {
    code: 'vyzov_v_no',
    name: 'Вызов в налоговый орган',
    specialistCode: null,
    categoryCode: 'tax_authority_interaction',
    clientTypes: ['legal_entity_ie', 'individual', 'npd_payer'],
  },
  {
    code: 'trebovanie_poyasneniy',
    name: 'Требование о представлении пояснений',
    specialistCode: null,
    categoryCode: 'tax_authority_interaction',
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    code: 'vyzov_na_dopros',
    name: 'Вызов на допрос',
    specialistCode: null,
    categoryCode: 'tax_authority_interaction',
    clientTypes: ['legal_entity_ie', 'individual', 'npd_payer'],
  },
  {
    code: 'istrebovanie_dokumentov',
    name: 'Истребование документов',
    specialistCode: null,
    categoryCode: 'tax_authority_interaction',
    clientTypes: ['legal_entity_ie'],
  },
  // enforcement
  {
    code: 'priostanovlenie_operaciy',
    name: 'Приостановление операций по счетам',
    specialistCode: null,
    categoryCode: 'enforcement',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'administrativnoe_proizvodstvo',
    name: 'Административное производство',
    specialistCode: 'Административное производство',
    categoryCode: 'enforcement',
    clientTypes: ['legal_entity_ie', 'individual'],
  },
  {
    code: 'bankrotstvo',
    name: 'Банкротство',
    specialistCode: 'Банкротство',
    categoryCode: 'enforcement',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'zadolzhennost',
    name: 'Задолженность',
    specialistCode: 'Задолженность',
    categoryCode: 'enforcement',
    clientTypes: ['legal_entity_ie'],
  },
  // registration
  {
    code: 'registraciya',
    name: 'Регистрация',
    specialistCode: 'Госрегистрация',
    categoryCode: 'registration',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'likvidaciya',
    name: 'Ликвидация',
    specialistCode: null,
    categoryCode: 'registration',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'dostovernost_egrul',
    name: 'Достоверность ЕГРЮЛ',
    specialistCode: null,
    categoryCode: 'registration',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'dostovernost_egrnip',
    name: 'Достоверность ЕГРНИП',
    specialistCode: null,
    categoryCode: 'registration',
    clientTypes: ['legal_entity_ie'],
  },
  // other
  {
    code: 'ens',
    name: 'ЕНС (Единый налоговый счёт)',
    specialistCode: null,
    categoryCode: 'other',
    clientTypes: ['legal_entity_ie', 'individual', 'npd_payer'],
  },
  {
    code: 'kkt',
    name: 'ККТ (Контрольно-кассовая техника)',
    specialistCode: 'ККТ',
    categoryCode: 'other',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'rsmp',
    name: 'РСМП (Реестр субъектов малого и среднего предпринимательства)',
    specialistCode: null,
    categoryCode: 'other',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'optimizaciya',
    name: 'Оптимизация налогообложения',
    specialistCode: null,
    categoryCode: 'other',
    clientTypes: ['legal_entity_ie'],
  },
  {
    code: 'voprosy_po_prilozheniyu',
    name: 'Вопросы по приложению',
    specialistCode: null,
    categoryCode: 'other',
    clientTypes: ['npd_payer'],
  },
]
