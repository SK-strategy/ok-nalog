'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { ClipboardList, CreditCard, FolderTree, UserCheck, Users, UserSquare2 } from 'lucide-react'

import { Skeleton } from '@tax-assistant/ui/skeleton'

import { useSession } from '~/entities/session'
import { api } from '~/shared/api'
import { PageHeader } from '~/shared/ui'

export function AdminDashboardPage() {
  const { me, isAuthenticated } = useSession()
  const skip = isAuthenticated ? {} : 'skip'
  const pendingExecutors = useQuery(api.executors.pendingCount, skip)
  const submitted = useQuery(
    api.orders.listByStatus,
    isAuthenticated ? { status: 'submitted' } : 'skip',
  )
  const awaitingPayment = useQuery(
    api.orders.listByStatus,
    isAuthenticated ? { status: 'awaiting_payment' } : 'skip',
  )
  const paid = useQuery(api.orders.listByStatus, isAuthenticated ? { status: 'paid' } : 'skip')
  const users = useQuery(api.users.listAllForAdmin, skip)
  const categories = useQuery(api.categories.listAll, skip)

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={me ? `Привет, ${me.user.name.split(' ')[0]}` : 'Панель администратора'}
        description="Что происходит в системе прямо сейчас"
      />

      <div className="bg-border grid gap-px sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          icon={<UserCheck className="size-4" />}
          label="Анкеты на рассмотрении"
          value={pendingExecutors}
          href="/executors?status=pending"
          accent={(pendingExecutors ?? 0) > 0}
        />
        <StatTile
          icon={<ClipboardList className="size-4" />}
          label="На проверке"
          value={submitted?.length}
          href="/orders"
        />
        <StatTile
          icon={<CreditCard className="size-4" />}
          label="Ожидают оплаты"
          value={awaitingPayment?.length}
          href="/orders"
        />
        <StatTile
          icon={<ClipboardList className="size-4" />}
          label="Ждут исполнителя"
          value={paid?.length}
          href="/orders"
        />
        <StatTile
          icon={<Users className="size-4" />}
          label="Пользователей"
          value={users?.length}
          href="/users"
        />
        <StatTile
          icon={<FolderTree className="size-4" />}
          label="Категорий"
          value={categories?.length}
          href="/categories"
        />
      </div>

      <div className="border-t px-6 py-6">
        <h2
          className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-semibold
            tracking-wider uppercase"
        >
          <UserSquare2 className="size-3.5" />
          Быстрые действия
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <QuickLink href="/executors?status=pending">Рассмотреть анкеты исполнителей</QuickLink>
          <QuickLink href="/orders">Очереди заявок</QuickLink>
          <QuickLink href="/users">Управление пользователями</QuickLink>
          <QuickLink href="/categories">Каталог категорий</QuickLink>
        </div>
      </div>
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  href,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number | undefined
  href: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className="bg-background hover:bg-secondary/50 flex flex-col gap-3 p-6 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </span>
        <span
          className={`flex size-7 items-center justify-center rounded-md ${
            accent && (value ?? 0) > 0
              ? 'bg-destructive/10 text-destructive'
              : 'bg-secondary text-muted-foreground'
            }`}
        >
          {icon}
        </span>
      </div>
      {value !== undefined ? (
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
      ) : (
        <Skeleton className="h-9 w-16" />
      )}
    </Link>
  )
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="hover:bg-accent hover:text-accent-foreground rounded-md border px-3 py-1.5 text-sm
        font-medium transition-colors"
    >
      {children}
    </Link>
  )
}
