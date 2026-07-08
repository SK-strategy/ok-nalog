'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { ArrowLeft, ClipboardList, Receipt } from 'lucide-react'

import type { OrderStatus } from '@tax-assistant/validators'
import { Skeleton } from '@tax-assistant/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tax-assistant/ui/table'
import { formatKopecks, formatRating } from '@tax-assistant/validators'

import { ApproveActions, PendingChangesCard } from '~/features/executor-approve'
import { PayoutButton } from '~/features/executor-payout'
import { useSession } from '~/entities/session'
import type { Id } from '~/shared/api'
import { api } from '~/shared/api'
import { formatDate, formatDateTime, shortId, useSort } from '~/shared/lib'
import {
  DataTable,
  EmptyState,
  ExecutorStatusBadge,
  OrderStatusBadge,
  PageHeader,
  SortHeader,
  UserCell,
} from '~/shared/ui'

interface OrderRow {
  _id: string
  status: OrderStatus
  categoryId: string
  categoryTitle: string | null
  approvedPrice?: number
  quotedPrice: number
  createdAt: number
  completedAt?: number
}

type OrderSortColumn = 'createdAt' | 'price' | 'status' | 'category'

interface ExecutorDetailPageProps {
  profileId: Id<'executorProfiles'>
}

export function ExecutorDetailPage({ profileId }: ExecutorDetailPageProps) {
  const { isAuthenticated } = useSession()
  const data = useQuery(api.executors.adminGet, isAuthenticated ? { profileId } : 'skip')

  const accessors = useMemo(
    () => ({
      createdAt: (r: OrderRow) => r.createdAt,
      price: (r: OrderRow) => r.approvedPrice ?? r.quotedPrice,
      status: (r: OrderRow) => r.status,
      category: (r: OrderRow) => r.categoryTitle?.toLowerCase() ?? '',
    }),
    [],
  )

  const orders = (data?.orders as OrderRow[] | undefined) ?? undefined
  const { sorted, dir, isActive, toggle } = useSort<OrderRow, OrderSortColumn>(orders, accessors, {
    column: 'createdAt',
    dir: 'desc',
  })

  if (data === undefined) {
    return (
      <div className="flex w-full flex-col gap-6 p-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const { profile, user, categories, pendingCategories, transactions } = data
  const pending = profile.pendingChanges

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={
          <div className="flex flex-col gap-2">
            <Link
              href="/executors"
              className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1
                text-xs font-medium transition-colors"
            >
              <ArrowLeft className="size-3.5" />К списку исполнителей
            </Link>
            <span>{profile.fullName}</span>
          </div>
        }
        description={
          <span className="flex items-center gap-3">
            <ExecutorStatusBadge status={profile.status} />
            <span className="text-muted-foreground">· Подана {formatDate(profile.createdAt)}</span>
          </span>
        }
        actions={
          profile.status === 'approved' ? (
            <PayoutButton profileId={profile._id} balance={profile.balance} />
          ) : profile.status === 'pending' ? (
            <ApproveActions profileId={profile._id} />
          ) : null
        }
      />

      {pending && (
        <PendingChangesCard
          profileId={profile._id}
          submittedAt={pending.submittedAt}
          current={{
            fullName: profile.fullName,
            bio: profile.bio,
            qualifications: profile.qualifications,
            categoryTitles: categories.map((c) => c.title),
          }}
          proposed={{
            fullName: pending.fullName,
            bio: pending.bio,
            qualifications: pending.qualifications,
            categoryTitles: (pendingCategories ?? []).map((c) => c.title),
          }}
        />
      )}

      <div className="bg-border grid gap-px lg:grid-cols-3">
        <section className="bg-background flex flex-col gap-4 p-6 lg:col-span-2">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Анкета
          </h2>

          {user && (
            <div className="flex items-center gap-3">
              <UserCell name={user.name} username={user.telegramUsername} image={user.image} />
            </div>
          )}

          <Field label="О себе" value={profile.bio} />
          <Field label="Квалификация" value={profile.qualifications} />
          <Field
            label="Тематика"
            value={
              categories.length > 0 ? categories.map((c) => c.title).join(' · ') : '— не выбрана'
            }
          />
          {profile.status === 'rejected' && profile.rejectionReason && (
            <Field label="Причина отказа" value={profile.rejectionReason} tone="destructive" />
          )}
        </section>

        <aside className="bg-background flex flex-col gap-3 p-6">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Финансы
          </h2>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Баланс к выплате</span>
            <span className="text-3xl font-semibold tabular-nums">
              {formatKopecks(profile.balance)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Рейтинг ответов</span>
            <span className="text-lg font-semibold tabular-nums">
              {(profile.ratingCount ?? 0) > 0
                ? `${formatRating(profile.ratingSum ?? 0, profile.ratingCount ?? 0)} / 10 · ${profile.ratingCount} оценок`
                : '— нет оценок'}
            </span>
          </div>
          <div className="border-t pt-3">
            <h3
              className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase"
            >
              Последние операции
            </h3>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-xs">Пока пусто</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {transactions.slice(0, 6).map((t) => (
                  <li key={t._id} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Receipt className="size-3" />
                      {t.type === 'accrual' ? 'Начисление' : 'Выплата'}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(t.createdAt)}
                    </span>
                    <span
                      className={`tabular-nums ${
                        t.amount >= 0 ? 'text-status-done' : 'text-status-fail' }`}
                    >
                      {t.amount >= 0 ? '+' : ''}
                      {formatKopecks(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <header className="flex items-center justify-between border-y px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ClipboardList className="size-4" />
          Заявки исполнителя
        </h2>
        <span className="text-muted-foreground text-sm tabular-nums">
          Всего: {orders?.length ?? 0}
        </span>
      </header>

      <DataTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>№</TableHead>
              <TableHead>
                <SortHeader
                  label="Категория"
                  active={isActive('category')}
                  dir={dir}
                  onToggle={() => toggle('category')}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label="Статус"
                  active={isActive('status')}
                  dir={dir}
                  onToggle={() => toggle('status')}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Стоимость"
                  active={isActive('price')}
                  dir={dir}
                  onToggle={() => toggle('price')}
                  align="right"
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label="Создана"
                  active={isActive('createdAt')}
                  dir={dir}
                  onToggle={() => toggle('createdAt')}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={<ClipboardList className="size-8" />}
                    title="Исполнителю пока не назначали заявок"
                  />
                </TableCell>
              </TableRow>
            )}
            {sorted.map((order) => (
              <TableRow key={order._id}>
                <TableCell className="font-mono text-xs">{shortId(order._id)}</TableCell>
                <TableCell>{order.categoryTitle ?? '—'}</TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatKopecks(order.approvedPrice ?? order.quotedPrice)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(order.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  )
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'destructive' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <p
        className={`text-sm whitespace-pre-wrap ${tone === 'destructive' ? 'text-destructive' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}
