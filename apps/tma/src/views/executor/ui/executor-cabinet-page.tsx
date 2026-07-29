'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import {
  Clock,
  Inbox,
  MessageSquareLock,
  Pencil,
  ShieldCheck,
  Sparkles,
  Tags,
  Wallet,
  XCircle,
} from 'lucide-react'

import type { OrderStatus } from '@tax-assistant/validators'
import { StarRating } from '@tax-assistant/ui/star-rating'
import { averageRating, formatKopecks, isTerminal } from '@tax-assistant/validators'

import type { HomeMode } from '~/widgets/mode-switcher'
import { ModeSwitcher } from '~/widgets/mode-switcher'
import { ProfileButton } from '~/widgets/profile-button'
import { TmaScreen } from '~/widgets/tma-shell'
import type { ExecutorApplicationInitial } from '~/features/executor-application'
import { AvailableOrderRow, AvailableOrderSheet } from '~/features/claim-order'
import {
  ExecutorApplicationForm,
  ProfileEditSheet,
  useExecutorApplication,
} from '~/features/executor-application'
import { OrderRow, OrdersList } from '~/entities/order'
import { useSession } from '~/entities/session'
import type { Doc, Id } from '~/shared/api'
import { api } from '~/shared/api'

type Order = Omit<Doc<'orders'>, 'customerId' | 'assignedExecutorId'>
type Profile = Doc<'executorProfiles'>

const EXECUTOR_ACTIVE_STATUSES = new Set<OrderStatus>(['assigned', 'in_progress', 'answered'])

/**
 * /executor — executor cabinet, dispatched by анкета status.
 *
 *  - No profile yet → <ApplyScreen>: hero + inline application form,
 *    submission goes to MainButton. Becoming an expert is the only thing
 *    this route can do for them, so the whole screen is the onboarding.
 *  - pending → <PendingScreen>: status hero + read-only анкета preview +
 *    edit affordance. Admin must approve before anything else opens.
 *  - rejected → <RejectedScreen>: rejection banner + revise form with the
 *    previous answers pre-filled, MainButton resubmits.
 *  - approved → <ApprovedCabinet>: the working surface — available pool,
 *    in-flight, balance, history, анкета edit.
 */
export function ExecutorCabinetPage() {
  const { isAuthenticated, me, isLoading } = useSession()
  const profile = useQuery(api.executors.myProfile, isAuthenticated ? {} : 'skip')

  // Wait until we know the executor's status. `me === undefined` is the
  // session bootstrap; once `me.executor !== null` the full profile query
  // must also resolve before we can render apply/preview UI.
  const sessionReady = !isLoading && me !== undefined
  const profileReady = !me?.executor || profile !== undefined
  if (!sessionReady || !profileReady) {
    return <LoadingScreen />
  }

  const executor = me?.executor
  if (!executor) return <ApplyScreen />
  if (executor.status === 'pending') return <PendingScreen profile={profile?.profile} />
  if (executor.status === 'rejected') return <RejectedScreen profile={profile?.profile} />
  return (
    <ApprovedCabinet
      profile={profile?.profile}
      balance={executor.balance}
      lifetimeEarned={profile?.lifetimeEarned ?? 0}
      completedCount={profile?.completedCount ?? 0}
    />
  )
}

// ─── loading ─────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <TmaScreen title="Кабинет эксперта">
      <div className="flex flex-col gap-4 px-4 pt-6">
        <div className="bg-secondary h-24 animate-pulse rounded-2xl" />
        <div className="bg-secondary h-40 animate-pulse rounded-2xl" />
      </div>
    </TmaScreen>
  )
}

// ─── apply (first-time) ──────────────────────────────────────────────────
function ApplyScreen() {
  const form = useExecutorApplication()
  return (
    <TmaScreen
      title="Стать экспертом"
      mainButton={{
        text: form.submitting ? 'Отправляем…' : 'Отправить анкету',
        onClick: () => void form.submit(),
        disabled: !form.canSubmit,
        loading: form.submitting,
      }}
    >
      <div className="flex flex-col gap-5 px-4 pt-3 pb-6">
        <Hero
          icon={<Sparkles className="size-6" strokeWidth={1.8} />}
          tone="primary"
          title="Консультируйте и получайте вознаграждение"
          body="Заполните короткую анкету — администратор проверит её и подключит вас к подходящим заявкам."
        />
        <Perks
          items={[
            {
              icon: <Inbox className="size-[18px]" strokeWidth={1.8} />,
              title: 'Заявки по вашим тематикам',
              body: 'Видите заявки сразу после оплаты клиентом — берёте те, что подходят.',
            },
            {
              icon: <MessageSquareLock className="size-[18px]" strokeWidth={1.8} />,
              title: 'Анонимный чат',
              body: 'Клиент не видит ваших контактов — общение только внутри заявки.',
            },
            {
              icon: <Wallet className="size-[18px]" strokeWidth={1.8} />,
              title: 'Прозрачные выплаты',
              body: 'Баланс пополняется после подтверждения ответа клиентом.',
            },
          ]}
        />
        <ExecutorApplicationForm form={form} />
        <TrustFooter text="После отправки анкета попадёт к администратору. Мы напишем сюда, как только её рассмотрят." />
      </div>
    </TmaScreen>
  )
}

// ─── pending (awaiting review) ───────────────────────────────────────────
function PendingScreen({ profile }: { profile: Profile | undefined }) {
  const [editOpen, setEditOpen] = useState(false)
  const initial = profile ? toInitial(profile) : undefined
  return (
    <TmaScreen title="Кабинет эксперта">
      <div className="flex flex-col gap-5 px-4 pt-3 pb-6">
        <Hero
          icon={<Clock className="size-6" strokeWidth={1.8} />}
          tone="pending"
          title="Анкета на проверке"
          body="Администратор просматривает вашу заявку. Обычно занимает до одного рабочего дня — мы напишем сюда, как только примем решение."
        />
        {profile && (
          <SubmittedPreview
            profile={profile}
            onEdit={() => setEditOpen(true)}
            editLabel="Изменить анкету"
          />
        )}
      </div>
      <ProfileEditSheet open={editOpen} initial={initial} onClose={() => setEditOpen(false)} />
    </TmaScreen>
  )
}

// ─── rejected (revise + resubmit) ────────────────────────────────────────
function RejectedScreen({ profile }: { profile: Profile | undefined }) {
  const initial = profile ? toInitial(profile) : undefined
  const form = useExecutorApplication({ initial })
  return (
    <TmaScreen
      title="Кабинет эксперта"
      mainButton={{
        text: form.submitting ? 'Отправляем…' : 'Отправить повторно',
        onClick: () => void form.submit(),
        disabled: !form.canSubmit,
        loading: form.submitting,
      }}
    >
      <div className="flex flex-col gap-5 px-4 pt-3 pb-6">
        <Hero
          icon={<XCircle className="size-6" strokeWidth={1.8} />}
          tone="rejected"
          title="Анкета не прошла проверку"
          body="Поправьте указанное ниже и отправьте заново — мы рассмотрим повторно."
        />
        {profile?.rejectionReason && (
          <div
            className="border-destructive/30 bg-destructive/5 mx-1 rounded-2xl border px-4 py-3.5"
          >
            <div className="text-destructive text-[11px] font-bold tracking-[0.06em] uppercase">
              Комментарий администратора
            </div>
            <p className="text-foreground mt-1 text-[13px] leading-relaxed whitespace-pre-wrap">
              {profile.rejectionReason}
            </p>
          </div>
        )}
        <ExecutorApplicationForm form={form} />
        <TrustFooter text="После повторной отправки анкета снова попадёт к администратору." />
      </div>
    </TmaScreen>
  )
}

// ─── approved (working surface) ──────────────────────────────────────────
function ApprovedCabinet({
  profile,
  balance,
  lifetimeEarned,
  completedCount,
}: {
  profile: Profile | undefined
  balance: number
  lifetimeEarned: number
  completedCount: number
}) {
  const router = useRouter()
  const { isAuthenticated, me } = useSession()

  const orders = useQuery(api.orders.assignedToMe, isAuthenticated ? {} : 'skip')
  const available = useQuery(api.orders.availableForExecutor, isAuthenticated ? {} : 'skip')
  const categories = useQuery(api.categories.listActive, isAuthenticated ? {} : 'skip')

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c])),
    [categories],
  )
  const { active, closed } = useMemo(() => splitAssigned(orders ?? []), [orders])
  const hasActive = active.length > 0
  const hasNoCategories = profile?.categoryIds.length === 0

  const [editOpen, setEditOpen] = useState(false)
  // Continue editing from the revision that's already awaiting review, if any —
  // otherwise from the live анкета.
  const initial = profile ? toInitial(profile.pendingChanges ?? profile) : undefined

  // Same allowed-modes logic as HomePage — approved executors always have
  // customer + executor; admins-who-also-executors get all three. The
  // switcher owns its own routing, so we just hand it the shape.
  const allowed: HomeMode[] = ['customer', 'executor']
  if (me?.user.role === 'admin') allowed.push('admin')

  return (
    <TmaScreen
      title="Кабинет эксперта"
      rightAction={
        <div className="flex items-center gap-2">
          <ModeSwitcher current="executor" allowed={allowed} />
          <ProfileButton />
        </div>
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

        <BalanceCard
          balance={balance}
          lifetimeEarned={lifetimeEarned}
          completedCount={completedCount}
          nickname={profile?.nickname ?? null}
          ratingSum={profile?.ratingSum ?? 0}
          ratingCount={profile?.ratingCount ?? 0}
        />

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
          <div className="flex flex-col gap-3">
            <ChangesBanner profile={profile} />
            <SubmittedPreview
              profile={profile}
              categoryById={categoryById}
              onEdit={() => setEditOpen(true)}
              editLabel="Изменить"
              headerLabel="Анкета"
            />
          </div>
        )}
      </div>

      <ProfileEditSheet open={editOpen} initial={initial} onClose={() => setEditOpen(false)} />
    </TmaScreen>
  )
}

// ─── hero card ───────────────────────────────────────────────────────────
function Hero({
  icon,
  tone,
  title,
  body,
}: {
  icon: React.ReactNode
  tone: 'primary' | 'pending' | 'rejected'
  title: string
  body: string
}) {
  const toneClasses =
    tone === 'rejected'
      ? 'bg-destructive/10 text-destructive'
      : tone === 'pending'
        ? 'bg-status-pay-bg text-status-pay'
        : 'bg-primary-soft text-primary'
  return (
    <div className="bg-card mx-1 flex flex-col gap-2 rounded-2xl p-5">
      <div className={`flex size-11 items-center justify-center rounded-2xl ${toneClasses}`}>
        {icon}
      </div>
      <h1 className="text-foreground mt-1 text-[20px] leading-tight font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-text-soft text-[14px] leading-relaxed">{body}</p>
    </div>
  )
}

// ─── perks list ──────────────────────────────────────────────────────────
function Perks({ items }: { items: { icon: React.ReactNode; title: string; body: string }[] }) {
  return (
    <div className="bg-card mx-1 overflow-hidden rounded-2xl">
      {items.map((item, i) => (
        <div
          key={item.title}
          className={`relative flex items-start gap-3 px-4 py-3.5 ${
          i > 0
              ? `before:bg-separator before:absolute before:top-0 before:right-0 before:left-[60px]
                before:h-px before:content-[""]`
              : ''
          }`}
        >
          <div
            className="bg-primary-soft text-primary flex size-9 shrink-0 items-center justify-center
              rounded-[10px]"
          >
            {item.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-[14px] font-semibold">{item.title}</p>
            <p className="text-text-soft mt-0.5 text-[13px] leading-snug">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── trust footer ────────────────────────────────────────────────────────
function TrustFooter({ text }: { text: string }) {
  return (
    <div className="text-hint flex items-start gap-2.5 px-1 pt-1">
      <ShieldCheck className="size-4 shrink-0 translate-y-px" strokeWidth={1.8} />
      <p className="text-[13px] leading-relaxed">{text}</p>
    </div>
  )
}

// ─── submitted-анкета preview ────────────────────────────────────────────
/**
 * The позывной, shown read-only inside the анкета.
 *
 * It's assigned automatically at `executors.apply` and is not an editable
 * field — the эксперт can't choose it, and nothing in the form writes it. It
 * needs to be visible from the moment the анкета is submitted (i.e. on the
 * pending screen too, before there's any cabinet or balance to look at),
 * because it's the name the админ will use to refer to this person.
 */
function NicknameRow({ nickname }: { nickname: string | null }) {
  if (!nickname) return null
  return (
    <p className="text-text-soft mt-0.5 text-[12px]">
      Позывной: <span className="text-foreground font-semibold">{nickname}</span>
      <span className="text-hint"> · клиенты его не видят</span>
    </p>
  )
}

function SubmittedPreview({
  profile,
  categoryById,
  onEdit,
  editLabel,
  headerLabel,
}: {
  profile: Profile
  categoryById?: Map<Id<'categories'>, Doc<'categories'>>
  onEdit: () => void
  editLabel: string
  headerLabel?: string
}) {
  const categoryTitles = profile.categoryIds
    .map((id) => categoryById?.get(id)?.title)
    .filter((t): t is string => !!t)
  return (
    <section>
      {headerLabel && (
        <div className="mb-2 flex items-end justify-between px-5">
          <h2 className="text-hint text-[12px] font-bold tracking-[0.06em] uppercase">
            {headerLabel}
          </h2>
          <button
            type="button"
            onClick={onEdit}
            className="text-primary -mr-1 flex items-center gap-1 px-1 text-[13px] font-semibold"
          >
            <Pencil className="size-3.5" />
            {editLabel}
          </button>
        </div>
      )}
      <div className="bg-card mx-1 flex flex-col gap-3 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-[15px] font-semibold">{profile.fullName}</p>
            <NicknameRow nickname={profile.nickname ?? null} />
            {categoryById && categoryTitles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categoryTitles.map((title) => (
                  <span
                    key={title}
                    className="bg-primary-soft text-primary inline-flex items-center rounded-full
                      px-2 py-0.5 text-[11px] font-semibold"
                  >
                    {title}
                  </span>
                ))}
              </div>
            )}
            {!categoryById && (
              <p className="text-text-soft mt-1 text-[12px]">
                Тематик выбрано: {profile.categoryIds.length}
              </p>
            )}
          </div>
          {!headerLabel && (
            <button
              type="button"
              onClick={onEdit}
              className="text-primary flex shrink-0 items-center gap-1 px-1 text-[13px]
                font-semibold"
            >
              <Pencil className="size-3.5" />
              {editLabel}
            </button>
          )}
        </div>
        <PreviewField label="О себе" value={profile.bio} />
        <PreviewField label="Квалификация и опыт" value={profile.qualifications} />
      </div>
    </section>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-hint text-[11px] font-bold tracking-[0.06em] uppercase">{label}</span>
      <p className="text-text-soft text-[13px] leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  )
}

// ─── available pool section ──────────────────────────────────────────────
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
  const [selectedId, setSelectedId] = useState<Id<'orders'> | null>(null)
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

  if (available === undefined) {
    return (
      <Section title={title}>
        <div className="bg-card mx-4 flex flex-col gap-3 overflow-hidden rounded-2xl p-4">
          <SkeletonRow />
          <div className="bg-separator h-px" />
          <SkeletonRow />
        </div>
      </Section>
    )
  }

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

  return (
    <>
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
              isFirst={i === 0}
              onSelect={() => setSelectedId(o._id)}
            />
          ))}
        </div>
      </Section>
      <AvailableOrderSheet
        orderId={selectedId}
        hasActive={hasActive}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-start gap-3">
      <div className="bg-secondary size-10 shrink-0 rounded-[10px]" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="bg-secondary h-3.5 w-2/3 rounded-full" />
        <div className="bg-secondary h-3 w-full rounded-full" />
        <div className="bg-secondary h-3 w-5/12 rounded-full" />
      </div>
    </div>
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

// ─── balance ─────────────────────────────────────────────────────────────
// Two figures side-by-side under one card:
//   - "К выплате" — the current accrued balance (zeroed on each payout)
//   - "Заработано" — lifetime sum of accruals, survives payouts
// The pair gives the executor a real sense of what they've earned through
// completed заявки, not just what they're about to be paid.
function BalanceCard({
  balance,
  lifetimeEarned,
  completedCount,
  nickname,
  ratingSum,
  ratingCount,
}: {
  balance: number
  lifetimeEarned: number
  completedCount: number
  nickname: string | null
  ratingSum: number
  ratingCount: number
}) {
  return (
    <div className="bg-primary-soft mx-4 rounded-2xl p-4">
      {nickname && (
        <div
          className="border-primary/15 mb-3 flex items-center justify-between gap-2 border-b pb-3"
        >
          <div>
            <div className="text-text-soft text-[11px] font-bold tracking-[0.06em] uppercase">
              Ваш позывной
            </div>
            <div className="text-foreground text-[15px] font-bold">{nickname}</div>
            {/* The handle is cover between the эксперт and the админ, not a
             *  display name — clients see an anonymous «Эксперт». Say so, or
             *  it reads as a public alias (which is what it used to be). */}
            <div className="text-text-soft mt-0.5 text-[11px]">
              Для связи с админом. Клиенты его не видят
            </div>
          </div>
          <StarRating value={averageRating(ratingSum, ratingCount)} count={ratingCount} showCount />
        </div>
      )}

      <div className="text-text-soft text-[12px] font-bold tracking-[0.06em] uppercase">
        Баланс к выплате
      </div>
      <div className="text-foreground mt-1 text-[28px] leading-none font-bold tabular-nums">
        {formatKopecks(balance)}
      </div>

      <div className="border-primary/15 mt-3.5 grid grid-cols-2 gap-3 border-t pt-3">
        <Stat label="Заработано всего" value={formatKopecks(lifetimeEarned)} />
        <Stat
          label="Выполнено заявок"
          value={`${completedCount} ${pluralRu(completedCount, 'заявка', 'заявки', 'заявок')}`}
        />
      </div>

      <div className="text-text-soft mt-3 text-[13px]">
        Начисляется после подтверждения заказчиком. Выплаты — администратором.
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-hint text-[11px] font-bold tracking-[0.04em] uppercase">{label}</div>
      <div className="text-foreground mt-0.5 truncate text-[16px] font-bold tabular-nums">
        {value}
      </div>
    </div>
  )
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

// ─── shared section header ───────────────────────────────────────────────
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

// ─── revision status banner ──────────────────────────────────────────────
// «На проверке» while an approved executor's edit sits in pendingChanges, or a
// rejection notice with the admin's comment. Clears once the revision is
// approved (both fields reset).
function ChangesBanner({ profile }: { profile: Profile }) {
  if (profile.pendingChanges) {
    return (
      <div
        className="border-status-pay/30 bg-status-pay-bg/50 mx-1 flex items-start gap-2.5
          rounded-2xl border px-4 py-3"
      >
        <Clock className="text-status-pay size-4 shrink-0 translate-y-px" strokeWidth={1.9} />
        <div>
          <p className="text-foreground text-[13px] font-semibold">Изменения на проверке</p>
          <p className="text-text-soft mt-0.5 text-[12px] leading-snug">
            Администратор подтвердит обновлённую анкету. Пока клиенты видят прежнюю версию.
          </p>
        </div>
      </div>
    )
  }
  if (profile.changeRejectionReason) {
    return (
      <div className="border-destructive/30 bg-destructive/5 mx-1 rounded-2xl border px-4 py-3">
        <p className="text-destructive flex items-center gap-2 text-[13px] font-semibold">
          <XCircle className="size-4 shrink-0" strokeWidth={1.9} />
          Изменения отклонены
        </p>
        <p className="text-foreground mt-1 text-[12px] leading-relaxed whitespace-pre-wrap">
          {profile.changeRejectionReason}
        </p>
      </div>
    )
  }
  return null
}

// ─── helpers ─────────────────────────────────────────────────────────────
function toInitial(profile: ExecutorApplicationInitial): ExecutorApplicationInitial {
  return {
    fullName: profile.fullName,
    bio: profile.bio,
    qualifications: profile.qualifications,
    categoryIds: [...profile.categoryIds],
  }
}

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
