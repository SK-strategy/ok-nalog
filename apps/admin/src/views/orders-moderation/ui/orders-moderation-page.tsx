'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { AlertCircle, ClipboardList } from 'lucide-react'

import type { OrderStatus } from '@tax-assistant/validators'
import { cn } from '@tax-assistant/ui'
import { Button } from '@tax-assistant/ui/button'
import { Skeleton } from '@tax-assistant/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tax-assistant/ui/table'
import { formatKopecks } from '@tax-assistant/validators'

import { OrderActionDialog } from '~/features/order-moderation'
import { useSession } from '~/entities/session'
import type { Id } from '~/shared/api'
import { api } from '~/shared/api'
import { formatDate, shortId, useSort } from '~/shared/lib'
import {
  DataTable,
  EmptyState,
  OrderStatusBadge,
  PageHeader,
  SortHeader,
  UserCell,
} from '~/shared/ui'

const ATTENTION_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'submitted',
  'paid',
  'payment_expired',
])

const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set(['completed', 'cancelled', 'rejected'])

// Lower number = appears higher when sorting "Статус" ascending.
// Attention rows pin to the top; closed orders drift to the bottom.
const STATUS_PRIORITY: Record<OrderStatus, number> = {
  submitted: 0,
  paid: 0,
  payment_expired: 0,
  awaiting_payment: 1,
  answered: 1,
  assigned: 2,
  in_progress: 2,
  priced: 2,
  completed: 3,
  cancelled: 3,
  rejected: 3,
}

const TABS: { value: TabValue; label: string }[] = [
  { value: 'attention', label: 'Требует внимания' },
  { value: 'all', label: 'Все' },
  { value: 'closed', label: 'Завершённые' },
]

type TabValue = 'attention' | 'all' | 'closed'

interface OrderRow {
  _id: Id<'orders'>
  status: OrderStatus
  description: string
  categoryId: string
  categoryTitle: string | null
  quotedPrice: number
  approvedPrice?: number
  createdAt: number
  customer: {
    _id: string
    name: string
    telegramUsername?: string
    image?: string
  } | null
  executor: {
    _id: string
    name: string
    telegramUsername?: string
    image?: string
  } | null
}

type SortColumn = 'status' | 'createdAt' | 'price' | 'category'

export function OrdersModerationPage() {
  const { isAuthenticated } = useSession()
  const orders = useQuery(api.orders.adminListAll, isAuthenticated ? {} : 'skip') as
    | OrderRow[]
    | undefined
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabValue | null
  const tab: TabValue = tabParam === 'all' || tabParam === 'closed' ? tabParam : 'attention'
  const [openOrderId, setOpenOrderId] = useState<Id<'orders'> | null>(null)

  const attentionCount = useMemo(
    () => orders?.filter((o) => ATTENTION_STATUSES.has(o.status)).length ?? 0,
    [orders],
  )

  const filtered = useMemo(() => {
    if (!orders) return undefined
    if (tab === 'attention') return orders.filter((o) => ATTENTION_STATUSES.has(o.status))
    if (tab === 'closed') return orders.filter((o) => TERMINAL_STATUSES.has(o.status))
    return orders
  }, [orders, tab])

  // Status accessor combines urgency bucket with recency so a single click on
  // "Статус" produces a sensible attention-first ordering.
  const accessors = useMemo(
    () => ({
      status: (r: OrderRow) => STATUS_PRIORITY[r.status] * 1e14 - r.createdAt,
      createdAt: (r: OrderRow) => r.createdAt,
      price: (r: OrderRow) => r.approvedPrice ?? r.quotedPrice,
      category: (r: OrderRow) => r.categoryTitle?.toLowerCase() ?? '',
    }),
    [],
  )

  const { sorted, dir, isActive, toggle } = useSort<OrderRow, SortColumn>(filtered, accessors, {
    column: 'status',
    dir: 'asc',
  })

  const tabs = (
    <div className="flex flex-wrap gap-1">
      {TABS.map((t) => {
        const active = t.value === tab
        const badge = t.value === 'attention' && attentionCount > 0 ? attentionCount : undefined
        return (
          <Link
            key={t.value}
            href={`/orders?tab=${t.value}`}
            className={cn(
              `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium
              transition-colors`,
              active
                ? 'bg-primary-soft text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <span>{t.label}</span>
            {badge !== undefined && (
              <span
                className="bg-destructive text-destructive-foreground inline-flex h-4 min-w-4
                  items-center justify-center rounded-full px-1 text-[10px] font-semibold
                  tabular-nums"
              >
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Заявки"
        description={
          orders
            ? `${filtered?.length ?? 0} из ${orders.length} · требуют внимания: ${attentionCount}`
            : undefined
        }
        footer={tabs}
      />

      <DataTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">№</TableHead>
              <TableHead>
                <SortHeader
                  label="Категория"
                  active={isActive('category')}
                  dir={dir}
                  onToggle={() => toggle('category')}
                />
              </TableHead>
              <TableHead className="min-w-[200px]">Клиент</TableHead>
              <TableHead className="min-w-[180px]">Исполнитель</TableHead>
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
                  label="Статус"
                  active={isActive('status')}
                  dir={dir}
                  onToggle={() => toggle('status')}
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
              <TableHead className="text-right">Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders === undefined && <OrdersSkeleton />}
            {orders && sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={<ClipboardList className="size-8" />}
                    title={
                      tab === 'attention'
                        ? 'Все заявки обработаны'
                        : tab === 'closed'
                          ? 'Закрытых заявок ещё нет'
                          : 'Заявок пока нет'
                    }
                    description={
                      tab === 'attention'
                        ? 'Хорошая работа — внимательных задач не осталось.'
                        : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {sorted.map((row) => {
              const attention = ATTENTION_STATUSES.has(row.status)
              const action = actionForStatus(row.status)
              return (
                <TableRow
                  key={row._id}
                  className={cn(
                    'group cursor-pointer',
                    attention && 'bg-destructive/[0.04] hover:bg-destructive/[0.07]',
                  )}
                  onClick={() => setOpenOrderId(row._id)}
                >
                  <TableCell className="font-mono text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      {attention && (
                        <AlertCircle
                          className="text-destructive size-3.5"
                          aria-label="Требует внимания"
                        />
                      )}
                      {shortId(row._id)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{row.categoryTitle ?? '—'}</span>
                      <span className="text-muted-foreground line-clamp-1 text-xs">
                        {row.description}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.customer ? (
                      <UserCell
                        name={row.customer.name}
                        username={row.customer.telegramUsername}
                        image={row.customer.image}
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.executor ? (
                      <UserCell
                        name={row.executor.name}
                        username={row.executor.telegramUsername}
                        image={row.executor.image}
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm italic">не назначен</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKopecks(row.approvedPrice ?? row.quotedPrice)}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant={action.variant}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenOrderId(row._id)
                        }}
                      >
                        {action.label}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </DataTable>

      <OrderActionDialog
        orderId={openOrderId}
        open={openOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenOrderId(null)
        }}
      />
    </div>
  )
}

function actionForStatus(status: OrderStatus): {
  label: string
  variant: 'default' | 'outline' | 'ghost' | 'destructive'
} {
  switch (status) {
    case 'submitted':
      return { label: 'Оценить', variant: 'default' }
    case 'paid':
      return { label: 'Назначить', variant: 'default' }
    case 'payment_expired':
      return { label: 'Открыть оплату', variant: 'default' }
    case 'awaiting_payment':
      return { label: 'Подтвердить оплату', variant: 'outline' }
    default:
      return { label: 'Открыть', variant: 'ghost' }
  }
}

function OrdersSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 8 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-5 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
