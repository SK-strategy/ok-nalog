'use client'

import { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { Search, Users } from 'lucide-react'

import { Input } from '@tax-assistant/ui/input'
import { Skeleton } from '@tax-assistant/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tax-assistant/ui/table'

import { RoleSelect } from '~/features/user-role'
import { useSession } from '~/entities/session'
import { api } from '~/shared/api'
import { formatDate, useSort } from '~/shared/lib'
import { DataTable, EmptyState, PageHeader, SortHeader, UserCell } from '~/shared/ui'

type UserSortColumn = 'name' | 'role' | 'orderCount' | 'completedOrderCount' | 'createdAt'

const ROLE_LABEL: Record<'customer' | 'executor' | 'admin', string> = {
  customer: 'Клиент',
  executor: 'Исполнитель',
  admin: 'Админ',
}

export function UsersListPage() {
  const { me, isAuthenticated } = useSession()
  const users = useQuery(api.users.listAllForAdmin, isAuthenticated ? {} : 'skip')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!users) return undefined
    const needle = search.trim().toLowerCase()
    if (!needle) return users
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(needle) ||
        (u.telegramUsername?.toLowerCase().includes(needle) ?? false) ||
        u.telegramId.includes(needle),
    )
  }, [users, search])

  const accessors = useMemo(
    () => ({
      name: (u: NonNullable<typeof users>[number]) => u.name.toLowerCase(),
      role: (u: NonNullable<typeof users>[number]) => u.role,
      orderCount: (u: NonNullable<typeof users>[number]) => u.orderCount,
      completedOrderCount: (u: NonNullable<typeof users>[number]) => u.completedOrderCount,
      createdAt: (u: NonNullable<typeof users>[number]) => u.createdAt,
    }),
    [],
  )

  const { sorted, dir, isActive, toggle } = useSort<
    NonNullable<typeof users>[number],
    UserSortColumn
  >(filtered, accessors, { column: 'createdAt', dir: 'desc' })

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Пользователи"
        description={users ? `Всего: ${users.length}` : undefined}
        actions={
          <div className="relative">
            <Search
              className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              placeholder="Поиск по имени, username, ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72 pl-9"
            />
          </div>
        }
      />

      <DataTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[260px]">
                <SortHeader
                  label="Пользователь"
                  active={isActive('name')}
                  dir={dir}
                  onToggle={() => toggle('name')}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label="Роль"
                  active={isActive('role')}
                  dir={dir}
                  onToggle={() => toggle('role')}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Заявок"
                  active={isActive('orderCount')}
                  dir={dir}
                  onToggle={() => toggle('orderCount')}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Выполнено"
                  active={isActive('completedOrderCount')}
                  dir={dir}
                  onToggle={() => toggle('completedOrderCount')}
                  align="right"
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label="Создан"
                  active={isActive('createdAt')}
                  dir={dir}
                  onToggle={() => toggle('createdAt')}
                />
              </TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users === undefined && <UsersSkeleton />}
            {users && sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={<Users className="size-8" />}
                    title="Пользователи не найдены"
                    description={search ? 'Попробуйте изменить запрос' : undefined}
                  />
                </TableCell>
              </TableRow>
            )}
            {sorted.map((user) => (
              <TableRow key={user._id}>
                <TableCell>
                  <UserCell name={user.name} username={user.telegramUsername} image={user.image} />
                </TableCell>
                <TableCell>
                  <span className="text-sm">{ROLE_LABEL[user.role]}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{user.orderCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {user.completedOrderCount}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <RoleSelect
                      userId={user._id}
                      role={user.role}
                      disabled={me?.user._id === user._id}
                    />
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

function UsersSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 6 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-5 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
