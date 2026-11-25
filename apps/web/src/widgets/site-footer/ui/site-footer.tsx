import Link from 'next/link'

/**
 * Landing footer (brief §4). Mounted by app/page.tsx only — product routes
 * have no footer. Three columns: legal entity details, documents, contacts.
 */

// TODO: подставить ссылки на соцсети.
const SOCIALS = [
  { name: 'Телеграм', href: '#', icon: TelegramIcon },
  { name: 'MAX', href: '#', icon: MaxIcon },
  { name: 'Дзен', href: '#', icon: DzenIcon },
  { name: 'Инста', href: '#', icon: InstagramIcon },
  { name: 'Тредс', href: '#', icon: ThreadsIcon },
] as const

export function SiteFooter() {
  return (
    <footer className="border-separator border-t">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- локальный SVG-логотип */}
          <img src="/logo.svg" alt="ОК, налог.нет" className="h-6 w-auto self-start" />
          <p className="text-text-soft text-[13px] leading-relaxed">
            Платформа налоговой экспертизы. Эксперты контрольных подразделений ФНС.
          </p>
          <p className="text-hint text-xs leading-relaxed">
            ИП Персиянов Константин Андреевич
            <br />
            ИНН 702400928036 · ОГРНИП 326700000034158
          </p>
        </div>

        <nav className="flex flex-col gap-2" aria-label="Документы">
          <span className="text-hint text-[12px] font-bold tracking-[0.06em] uppercase">
            Документы
          </span>
          <FooterLink href="/oferta">Пользовательское соглашение</FooterLink>
          <FooterLink href="/politika">Политика конфиденциальности</FooterLink>
          <FooterLink href="/politika-pd">Политика обработки персональных данных</FooterLink>
          <FooterLink href="/soglasie">Согласие на обработку персональных данных</FooterLink>
          <FooterLink href="/oplata">Правила оплаты и возврата</FooterLink>
          <FooterLink href="/tarify">Тарифы и сроки ответов</FooterLink>
          <FooterLink href="/cookie">Уведомление о cookie</FooterLink>
          <FooterLink href="/dogovor-ekspertov">Договор и правила для экспертов</FooterLink>
        </nav>

        <div className="flex flex-col gap-3">
          <span className="text-hint text-[12px] font-bold tracking-[0.06em] uppercase">
            Контакты
          </span>
          <p className="text-text-soft text-[13px] leading-relaxed">
            <a
              href="mailto:oknalog@mail.ru"
              className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm outline-none
                focus-visible:ring-[3px]"
            >
              oknalog@mail.ru
            </a>
            <br />
            Томская область
          </p>
          <div className="flex items-center gap-3">
            {SOCIALS.map(({ name, href, icon: Icon }) => (
              <a
                key={name}
                href={href}
                aria-label={name}
                className="text-text-soft hover:text-foreground focus-visible:ring-ring/50
                  rounded-sm outline-none focus-visible:ring-[3px]"
              >
                <Icon />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-separator border-t">
        <div className="text-hint mx-auto max-w-5xl px-4 py-4 text-xs sm:px-6">
          © 2026 ОК, налог.нет
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-text-soft hover:text-foreground focus-visible:ring-ring/50 rounded-sm
        text-[13px] outline-none focus-visible:ring-[3px]"
    >
      {children}
    </Link>
  )
}

const iconClass = 'size-5'

function TelegramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClass}
      aria-hidden="true"
    >
      <path d="M21 4 3.5 10.8c-.8.3-.8 1.4.1 1.6l4.4 1.4 1.7 5.2c.3.8 1.3.9 1.8.2l2.4-3" />
      <path d="M21 4 9.5 13.5" />
      <path d="m21 4-5.5 15" />
    </svg>
  )
}

function MaxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClass}
      aria-hidden="true"
    >
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="m8 13 2.5-4 2 3 2.5-4v7" />
    </svg>
  )
}

function DzenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClass}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 7.5v9" />
      <path d="M8.5 10.5 12 7.5l3.5 3" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClass}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ThreadsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClass}
      aria-hidden="true"
    >
      <path d="M15.5 12.5c0 4-2 6.5-4.7 6.5-2.5 0-4.3-1.9-4.3-4.5 0-3.4 2.8-5.5 6.4-5.5 3.1 0 5.6 1.2 5.6 4" />
      <path d="M15.5 12.5c.8 2 2.5 2.8 2.5 4.7 0 1.6-1.2 2.8-3 2.8" />
      <path d="M13 5.5C12.5 4.3 11.3 3.5 10 3.5 7.5 3.5 5.5 6 5.5 9.5" />
    </svg>
  )
}
