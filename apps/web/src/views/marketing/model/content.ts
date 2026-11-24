/**
 * Landing copy, straight from brief.md. Texts are not rewritten — only
 * structured. Filled per section as sections land.
 */

export const HERO = {
  badge: 'Экспертиза из системы',
  title: 'Вам пришло требование из налоговой. Разберут те, кто сам их рассылал.',
  subtitle:
    'Загрузите документ — получите расшифровку, готовый ответ и прогноз. ' +
    'Не бот и не шаблон: работают эксперты контрольных подразделений ФНС, ' +
    '300 лет совокупного опыта.',
  ctaGuest: 'Загрузить документ',
  ctaAuthed: 'Перейти к обращениям',
  ctaSecondary: 'Как это работает',
} as const

/** Section 2 — proof strip (brief §4). Numbers must not change (24 ч — §14). */
export const PROOF = [
  { value: '300 лет', label: 'в контрольных подразделениях ФНС' },
  { value: '15 лет', label: 'основатель в системе' },
  { value: '24 часа', label: 'на ответ эксперта' },
  { value: 'Шифрование', label: 'файл шифруется сразу при загрузке' },
] as const

/**
 * Section 3 — topics catalog. Codes/titles mirror the real nomenclature in
 * backend/convex/convex/seedData.ts (CATEGORIES_SEED); keep in sync manually
 * until the landing reads it from the backend.
 * TODO: replace expertCount with real per-topic expert counts.
 */
export const TOPICS = [
  { code: 'tax_audits', title: 'Налоговые проверки', expertCount: 14 },
  { code: 'tax_authority_interaction', title: 'Взаимодействие с налоговой', expertCount: 11 },
  { code: 'enforcement', title: 'Принудительные меры и взыскание', expertCount: 8 },
  { code: 'main_taxes', title: 'Основные налоги', expertCount: 12 },
  { code: 'special_regimes', title: 'Спецрежимы', expertCount: 6 },
  { code: 'property_taxes', title: 'Имущественные налоги', expertCount: 4 },
  { code: 'resource_taxes', title: 'Ресурсные налоги и акцизы', expertCount: 3 },
  { code: 'reporting', title: 'Отчётность и взносы', expertCount: 7 },
  { code: 'registration', title: 'Регистрационные действия', expertCount: 5 },
  { code: 'other', title: 'Прочее', expertCount: 9 },
] as const

/**
 * Section 4 — process steps. The ДОП principles are woven into the steps as
 * explanation, not slogans (brief §4). Step 3 — 24 ч (§14); step 2 mentions
 * topic-based routing.
 */
export const STEPS = [
  {
    action: 'Загрузите документ или опишите ситуацию',
    body: 'Файл шифруется сразу при загрузке.',
    principle: 'приватно',
  },
  {
    action: 'Материал попадает к экспертам',
    body: '300 лет в контрольных подразделениях ФНС. Заявка уходит эксперту по вашей тематике.',
    principle: 'достоверно',
  },
  {
    action: 'Ответ в срок',
    body: 'Не более 24 часов.',
    principle: 'оперативно',
  },
  {
    action: 'Разбор строго по вашим документам',
    body: 'Клинический подход: только ваша ситуация, без общих слов.',
    principle: 'персонализировано',
  },
  {
    action: 'Прогноз и план',
    body: 'Какое решение будет принято и как к нему готовиться.',
    principle: 'предиктивно',
  },
] as const

/** Section 5 — what you get (brief §3). */
export const DELIVERABLES = [
  {
    title: 'Расшифровка документа',
    body: 'Что на самом деле написано и чего от вас хотят.',
  },
  {
    title: 'Готовый документ',
    body: 'Мотивированный ответ, возражение или ходатайство — с шаблоном.',
  },
  {
    title: 'Дорожная карта',
    body: 'Что сегодня, что завтра, к какому сроку.',
  },
  {
    title: 'Прогноз',
    body: 'Чего ждать от инспектора, какие шаги последуют, как готовиться.',
  },
] as const
