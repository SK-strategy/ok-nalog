'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { PencilLine, UserSquare2 } from 'lucide-react'

import { cn } from '@tax-assistant/ui'
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

import { ApproveActions } from '~/features/executor-approve'
import { useSession } from '~/entities/session'
import { api } from '~/shared/api'
import { formatDate, useSort } from '~/shared/lib'
import {
  DataTable,
  EmptyState,
  ExecutorStatusBadge,
  PageHeader,
  SortHeader,
  UserCell,
} from '~/shared/ui'

type StatusFilter = 'pending' | 'changes' | 'approved' | 'rejected' | 'all'

interface ExecutorRow {
  _id: string
  userId: string
  fullName: string
  balance: number
  status: 'pending' | 'approved' | 'rejected'
  hasPendingChanges: boolean
  createdAt: number
  reviewedAt?: number
  assignedOrderCount: number
  completedOrderCount: number
  activeOrderCount: number
  user: {
    _id: string
    name: string
    telegramUsername?: string
    image?: string
  } | null
}

type SortColumn = 'fullName' | 'status' | 'balance' | 'createdAt' | 'completedOrderCount'

const TABS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'На рассмотрении' },
  { value: 'changes', label: 'С изменениями' },
  { value: 'approved', label: 'Одобренные' },
  { value: 'rejected', label: 'Отклонённые' },
  { value: 'all', label: 'Все' },
]

export function ExecutorsListPage() {
  const { isAuthenticated } = useSession()
  const searchParams = useSearchParams()
  const status = (searchParams.get('status') as StatusFilter | null) ?? 'pending'
  const validStatus: StatusFilter = (
    ['pending', 'changes', 'approved', 'rejected', 'all'] as const
  ).includes(status)
    ? status
    : 'pending'

  // «С изменениями» isn't a stored status — it filters approved profiles that
  // carry a pending revision, so it fetches the full list and narrows client-
  // side (same as «Все»).
  const usesStatusIndex = validStatus !== 'all' && validStatus !== 'changes'
  const rawExecutors = useQuery(
    api.executors.adminListAll,
    isAuthenticated ? (usesStatusIndex ? { status: validStatus } : {}) : 'skip',
  ) as ExecutorRow[] | undefined
  const executors =
    validStatus === 'changes' ? rawExecutors?.filter((r) => r.hasPendingChanges) : rawExecutors

  const pendingCount = useQuery(api.executors.pendingCount, isAuthenticated ? {} : 'skip')
  const changesCount = useQuery(api.executors.pendingChangesCount, isAuthenticated ? {} : 'skip')

  const accessors = useMemo(
    () => ({
      fullName: (r: ExecutorRow) => r.fullName.toLowerCase(),
      status: (r: ExecutorRow) => r.status,
      balance: (r: ExecutorRow) => r.balance,
      createdAt: (r: ExecutorRow) => r.createdAt,
      completedOrderCount: (r: ExecutorRow) => r.completedOrderCount,
    }),
    [],
  )

  const initialColumn: SortColumn = validStatus === 'pending' ? 'createdAt' : 'balance'
  const { sorted, dir, isActive, toggle } = useSort<ExecutorRow, SortColumn>(executors, accessors, {
    column: initialColumn,
    dir: 'desc',
  })

  const tabs = (
    <div className="flex flex-wrap gap-1">
      {TABS.map((tab) => {
        const active = tab.value === validStatus
        const badge =
          tab.value === 'pending'
            ? pendingCount
            : tab.value === 'changes'
              ? changesCount
              : undefined
        return (
          <Link
            key={tab.value}
            href={`/executors?status=${tab.value}`}
            className={cn(
              `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium
              transition-colors`,
              active
                ? 'bg-primary-soft text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <span>{tab.label}</span>
            {badge !== undefined && badge > 0 && (
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
        title="Исполнители"
        description={
          executors
            ? `${executors.length} анкет${pluralEnding(executors.length)} в выбранной вкладке`
            : undefined
        }
        footer={tabs}
      />

      <DataTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[240px]">
                <SortHeader
                  label="Анкета"
                  active={isActive('fullName')}
                  dir={dir}
                  onToggle={() => toggle('fullName')}
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
                  label="Баланс"
                  active={isActive('balance')}
                  dir={dir}
                  onToggle={() => toggle('balance')}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-right">Активных</TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Закрыто"
                  active={isActive('completedOrderCount')}
                  dir={dir}
                  onToggle={() => toggle('completedOrderCount')}
                  align="right"
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label="Подана"
                  active={isActive('createdAt')}
                  dir={dir}
                  onToggle={() => toggle('createdAt')}
                />
              </TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {executors === undefined && <ExecutorsSkeleton />}
            {executors && sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={<UserSquare2 className="size-8" />}
                    title="Нет анкет в этой вкладке"
                  />
                </TableCell>
              </TableRow>
            )}
            {sorted.map((row) => (
              <TableRow key={row._id}>
                <TableCell>
                  <Link
                    href={`/executors/${row._id}`}
                    className="hover:text-primary block transition-colors"
                  >
                    <UserCell
                      name={row.fullName}
                      username={row.user?.telegramUsername}
                      image={row.user?.image}
                    />
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ExecutorStatusBadge status={row.status} />
                    {row.hasPendingChanges && (
                      <span
                        className="bg-status-pay-bg text-status-pay inline-flex items-center gap-1
                          rounded-full px-2 py-0.5 text-[11px] font-medium"
                      >
                        <PencilLine className="size-3" />
                        Правки
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatKopecks(row.balance)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.activeOrderCount}</TableCell>
                <TableCell className="text-right tabular-nums">{row.completedOrderCount}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.status === 'pending' ? (
                      <ApproveActions profileId={row._id as never} size="sm" compact />
                    ) : (
                      <Link
                        href={`/executors/${row._id}`}
                        className="hover:bg-accent hover:text-accent-foreground rounded-md border
                          px-3 py-1.5 text-xs font-medium transition-colors"
                      >
                        Открыть
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  )
}

function pluralEnding(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'а'
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return 'ы'
  return ''
}

function ExecutorsSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-5 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
