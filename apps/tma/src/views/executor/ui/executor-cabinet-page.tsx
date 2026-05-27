'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { Briefcase, Inbox, Pencil, Sparkles, Tags } from 'lucide-react'

import type { OrderStatus } from '@tax-assistant/validators'
import { formatKopecks, isTerminal } from '@tax-assistant/validators'

import { TmaScreen } from '~/widgets/tma-shell'
import { AvailableOrderRow } from '~/features/claim-order'
import { ProfileEditSheet } from '~/features/executor-application'
import { OrderRow, OrdersList } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'

type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>

const EXECUTOR_ACTIVE_STATUSES = new Set<OrderStatus>(['assigned', 'in_progress', 'answered'])

/**
 * /executor — executor cabinet.
 *
 * The primary surface is the "Доступные заявки" pool: every paid, still
 * unassigned order that matches one of the executor's tematics. The expert
 * picks one inline; if they already have something in flight, claim buttons
 * are disabled until that order resolves. The rest of the cabinet (balance,
 * history, anketa) supports that decision.
 *
 * Non-approved users hit a soft gate explaining what they need to do.
 */
export function ExecutorCabinetPage() {
  const router = useRouter()
  const { me, isAuthenticated } = useSession()
  const isApproved = me?.executor?.status === 'approved'

  const orders = useQuery(api.orders.assignedToMe, isAuthenticated && isApproved ? {} : 'skip')
  const available = useQuery(
    api.orders.availableForExecutor,
    isAuthenticated && isApproved ? {} : 'skip',
  )
  const profile = useQuery(api.executors.myProfile, isAuthenticated && isApproved ? {} : 'skip')
  const categories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c])),
    [categories],
  )
  const { active, closed } = useMemo(() => splitAssigned(orders ?? []), [orders])
  const hasActive = active.length > 0
  const hasNoCategories = profile !== undefined && profile?.profile.categoryIds.length === 0

  const [editOpen, setEditOpen] = useState(false)

  if (!isApproved) {
    return (
      <TmaScreen title="Кабинет эксперта">
        <div className="flex flex-col items-center gap-3 px-6 pt-16 text-center">
          <Briefcase className="text-hint size-10" strokeWidth={1.6} />
          <p className="text-foreground text-base font-bold">Доступ только для экспертов</p>
          <p className="text-text-soft text-sm">
            Заполните анкету и дождитесь одобрения, чтобы видеть назначенные заявки.
          </p>
        </div>
      </TmaScreen>
    )
  }

  const balance = me.executor?.balance ?? 0
  const profileInitial = profile
    ? {
        fullName: profile.profile.fullName,
        bio: profile.profile.bio,
        qualifications: profile.profile.qualifications,
        categoryIds: [...profile.profile.categoryIds],
      }
    : undefined
  const profileCategoryTitles = (profile?.profile.categoryIds ?? [])
    .map((id) => categoryById.get(id)?.title)
    .filter((t): t is string => !!t)

  return (
    <TmaScreen
      title="Кабинет эксперта"
      rightAction={
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="text-primary p-1 text-[13px] font-semibold"
          aria-label="Редактировать анкету"
        >
          Анкета
        </button>
      }
    >
      <div className="flex flex-col gap-5 pt-3 pb-2">
        {/* PRIMARY: orders waiting for an executor — the reason this page
            exists. Always rendered, regardless of state, so the executor
            can immediately see whether there's work to take. */}
        <AvailableSection
          available={available}
          hasActive={hasActive}
          hasNoCategories={hasNoCategories}
          categoryById={categoryById}
          onEditProfile={() => setEditOpen(true)}
        />

        {active.length > 0 && (
          <Section title={`В работе · ${active.length}`}>
            <OrdersList>
              {active.map((o, i) => (
                <OrderRow
                  key={o._id}
                  order={o}
                  category={categoryById.get(o.categoryId)}
                  isFirst={i === 0}
                  onClick={() => router.push(`/orders/${o._id}`)}
                />
              ))}
            </OrdersList>
          </Section>
        )}

        <BalanceCard balance={balance} />

        {closed.length > 0 && (
          <Section title={`Завершённые · ${closed.length}`}>
            <OrdersList>
              {closed.map((o, i) => (
                <OrderRow
                  key={o._id}
                  order={o}
                  category={categoryById.get(o.categoryId)}
                  isFirst={i === 0}
                  onClick={() => router.push(`/orders/${o._id}`)}
                />
              ))}
            </OrdersList>
          </Section>
        )}

        {profile && (
          <ProfileCard
            fullName={profile.profile.fullName}
            bio={profile.profile.bio}
            qualifications={profile.profile.qualifications}
            categoryTitles={profileCategoryTitles}
            onEdit={() => setEditOpen(true)}
          />
        )}
      </div>

      <ProfileEditSheet
        open={editOpen}
        initial={profileInitial}
        onClose={() => setEditOpen(false)}
      />
    </TmaScreen>
  )
}

// ─── available pool section ───────────────────────────────────────────────
function AvailableSection({
  available,
  hasActive,
  hasNoCategories,
  categoryById,
  onEditProfile,
}: {
  available: Order[] | undefined
  hasActive: boolean
  hasNoCategories: boolean
  categoryById: Map<Id<'categories'>, Doc<'categories'>>
  onEditProfile: () => void
}) {
  const count = available?.length ?? 0
  const title = (
    <span className="flex items-center gap-2">
      <Sparkles className="text-primary size-4" strokeWidth={1.8} />
      Доступные заявки
      {count > 0 && (
        <span
          className="bg-primary text-primary-foreground inline-flex h-5 min-w-5 items-center
            justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
        >
          {count}
        </span>
      )}
    </span>
  )

  // Loading.
  if (available === undefined) {
    return (
      <Section title={title}>
        <div className="bg-secondary mx-4 h-24 animate-pulse rounded-2xl" />
      </Section>
    )
  }

  // No categories selected — block by anketa, not by orders.
  if (hasNoCategories) {
    return (
      <Section title={title}>
        <EmptyCard
          icon={<Tags className="size-7" strokeWidth={1.6} />}
          title="Выберите тематики в анкете"
          body="Чтобы видеть подходящие заявки, отметьте категории, по которым вы консультируете."
          cta={{ label: 'Открыть анкету', onClick: onEditProfile }}
        />
      </Section>
    )
  }

  // No matching paid orders right now.
  if (count === 0) {
    return (
      <Section title={title}>
        <EmptyCard
          icon={<Inbox className="size-7" strokeWidth={1.6} />}
          title="Сейчас свободных заявок нет"
          body="Заявки появятся здесь сразу после оплаты клиентом. Можно расширить список тематик в анкете."
          cta={{ label: 'Изменить тематики', onClick: onEditProfile, variant: 'ghost' }}
        />
      </Section>
    )
  }

  // Have orders to pick.
  return (
    <Section
      title={title}
      hint={hasActive ? 'Завершите текущую заявку, чтобы взять новую' : undefined}
    >
      <div className="bg-card mx-4 overflow-hidden rounded-2xl">
        {available.map((o, i) => (
          <AvailableOrderRow
            key={o._id}
            order={o}
            category={categoryById.get(o.categoryId)}
            hasActive={hasActive}
            isFirst={i === 0}
          />
        ))}
      </div>
    </Section>
  )
}

function EmptyCard({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode
  title: string
  body: string
  cta?: { label: string; onClick: () => void; variant?: 'primary' | 'ghost' }
}) {
  const variant = cta?.variant ?? 'primary'
  return (
    <div className="bg-card mx-4 flex flex-col items-center gap-2 rounded-2xl px-5 py-6 text-center">
      <div className="text-hint">{icon}</div>
      <p className="text-foreground text-[15px] font-bold">{title}</p>
      <p className="text-text-soft text-[13px] leading-snug">{body}</p>
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className={
            variant === 'primary'
              ? `bg-primary text-primary-foreground mt-2 rounded-xl px-4 py-2 text-[14px]
                font-semibold`
              : 'text-primary mt-1 px-2 py-1 text-[13px] font-semibold'
          }
        >
          {cta.label}
        </button>
      )}
    </div>
  )
}

// ─── profile summary card ─────────────────────────────────────────────────
function ProfileCard({
  fullName,
  bio,
  qualifications,
  categoryTitles,
  onEdit,
}: {
  fullName: string
  bio: string
  qualifications: string
  categoryTitles: string[]
  onEdit: () => void
}) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between px-5">
        <h2 className="text-hint text-[12px] font-bold tracking-[0.06em] uppercase">Анкета</h2>
        <button
          type="button"
          onClick={onEdit}
          className="text-primary -mr-1 flex items-center gap-1 px-1 text-[13px] font-semibold"
        >
          <Pencil className="size-3.5" />
          Изменить
        </button>
      </div>
      <div className="bg-card mx-4 flex flex-col gap-3 rounded-2xl p-4">
        <div>
          <p className="text-foreground text-[15px] font-semibold">{fullName}</p>
          {categoryTitles.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categoryTitles.map((title) => (
                <span
                  key={title}
                  className="bg-primary-soft text-primary inline-flex items-center rounded-full px-2
                    py-0.5 text-[11px] font-semibold"
                >
                  {title}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-status-pay mt-2 text-[12px] font-semibold">
              Тематики не выбраны — заявки не появятся
            </p>
          )}
        </div>
        <Field label="О себе" value={bio} />
        <Field label="Квалификация и опыт" value={qualifications} />
      </div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-hint text-[11px] font-bold tracking-[0.06em] uppercase">{label}</span>
      <p className="text-text-soft text-[13px] leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  )
}

// ─── balance ──────────────────────────────────────────────────────────────
function BalanceCard({ balance }: { balance: number }) {
  return (
    <div className="bg-primary-soft mx-4 rounded-2xl p-4">
      <div className="text-text-soft text-[12px] font-bold tracking-[0.06em] uppercase">
        Баланс к выплате
      </div>
      <div className="text-foreground mt-1 text-[28px] leading-none font-bold tabular-nums">
        {formatKopecks(balance)}
      </div>
      <div className="text-text-soft mt-1.5 text-[13px]">
        Начисляется после подтверждения заказчиком. Выплаты — администратором.
      </div>
    </div>
  )
}

// ─── shared section header ────────────────────────────────────────────────
function Section({
  title,
  hint,
  children,
}: {
  title: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between gap-3 px-5">
        <h2 className="text-foreground text-[14px] font-bold tracking-tight">{title}</h2>
        {hint && <span className="text-status-pay text-[12px] font-semibold">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────
function splitAssigned(orders: Order[]): { active: Order[]; closed: Order[] } {
  const active: Order[] = []
  const closed: Order[] = []
  for (const o of orders) {
    if (isTerminal(o.status)) closed.push(o)
    else if (EXECUTOR_ACTIVE_STATUSES.has(o.status)) active.push(o)
    else closed.push(o)
  }
  return { active, closed }
}
