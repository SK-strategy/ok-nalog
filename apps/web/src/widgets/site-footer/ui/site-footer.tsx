import Link from 'next/link'

/**
 * Landing footer (brief §4). Mounted by app/page.tsx only — product routes
 * have no footer. Three columns: legal entity details, documents, contacts.
 * Реквизиты и контакты — [уточнить] до ответа заказчика.
 */
export function SiteFooter() {
  return (
    <footer className="border-separator border-t">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div className="flex flex-col gap-2">
          <span className="text-foreground text-sm font-bold">ОК, налог.нет</span>
          <p className="text-text-soft text-[13px] leading-relaxed">
            Платформа налоговой экспертизы. Эксперты контрольных подразделений ФНС.
          </p>
          <p className="text-hint text-xs">Юрлицо, ИНН/ОГРН — [уточнить]</p>
        </div>

        <nav className="flex flex-col gap-2" aria-label="Документы">
          <span className="text-hint text-[12px] font-bold tracking-[0.06em] uppercase">
            Документы
          </span>
          <FooterLink href="/oferta">Оферта</FooterLink>
          <FooterLink href="/politika">Политика конфиденциальности</FooterLink>
          <FooterLink href="/soglasie">Согласие на обработку данных</FooterLink>
        </nav>

        <div className="flex flex-col gap-2">
          <span className="text-hint text-[12px] font-bold tracking-[0.06em] uppercase">
            Контакты
          </span>
          <p className="text-text-soft text-[13px]">Telegram — [уточнить]</p>
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
