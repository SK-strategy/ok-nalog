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
