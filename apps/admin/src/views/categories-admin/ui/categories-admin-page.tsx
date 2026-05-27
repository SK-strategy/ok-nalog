'use client'

import { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { FolderTree, Plus, Tags } from 'lucide-react'

import type { ClientType } from '@tax-assistant/validators'
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

import { CategoryActiveToggle, CategoryFormDialog } from '~/features/category-admin'
import { useSession } from '~/entities/session'
import type { Doc } from '~/shared/api'
import { api } from '~/shared/api'
import { useSort } from '~/shared/lib'
import { ClientTypePills, DataTable, EmptyState, PageHeader, SortHeader } from '~/shared/ui'

interface CategoryRow extends Doc<'categories'> {
  tagCount: number
  activeTagCount: number
}

type CategorySortColumn = 'title' | 'basePrice' | 'tagCount' | 'sortOrder' | 'status'

export function CategoriesAdminPage() {
  const { isAuthenticated } = useSession()
  const categories = useQuery(api.categories.adminListAll, isAuthenticated ? {} : 'skip') as
    | CategoryRow[]
    | undefined
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRow | undefined>(undefined)

  const accessors = useMemo(
    () => ({
      title: (r: CategoryRow) => r.title.toLowerCase(),
      basePrice: (r: CategoryRow) => r.basePrice,
      tagCount: (r: CategoryRow) => r.tagCount,
      sortOrder: (r: CategoryRow) => r.sortOrder,
      status: (r: CategoryRow) => (r.isActive ? 0 : 1),
    }),
    [],
  )

  const { sorted, dir, isActive, toggle } = useSort<CategoryRow, CategorySortColumn>(
    categories,
    accessors,
    { column: 'sortOrder', dir: 'asc' },
  )

  const nextSortOrder = (categories?.length ?? 0) + 1

  function openCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(row: CategoryRow) {
    setEditing(row)
    setDialogOpen(true)
  }

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Категории"
        description={categories ? `Всего: ${categories.length}` : 'Каталог тематик для клиента'}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Добавить категорию
          </Button>
        }
      />

      <DataTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[280px]">
                <SortHeader
                  label="Категория"
                  active={isActive('title')}
                  dir={dir}
                  onToggle={() => toggle('title')}
                />
              </TableHead>
              <TableHead className="min-w-[160px]">Подходит клиентам</TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Стоимость"
                  active={isActive('basePrice')}
                  dir={dir}
                  onToggle={() => toggle('basePrice')}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Тегов"
                  active={isActive('tagCount')}
                  dir={dir}
                  onToggle={() => toggle('tagCount')}
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
              <TableHead className="text-right">
                <SortHeader
                  label="Порядок"
                  active={isActive('sortOrder')}
                  dir={dir}
                  onToggle={() => toggle('sortOrder')}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories === undefined && <CategoriesSkeleton />}
            {categories && sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={<FolderTree className="size-8" />}
                    title="Категории ещё не созданы"
                    description="Нажмите «Добавить категорию», чтобы наполнить каталог."
                  />
                </TableCell>
              </TableRow>
            )}
            {sorted.map((row) => (
              <TableRow key={row._id} className="cursor-pointer" onClick={() => openEdit(row)}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{row.title}</span>
                    <span className="text-muted-foreground line-clamp-1 text-xs">
                      {row.description}
                    </span>
                    {row.code && (
                      <span className="text-muted-foreground font-mono text-[10px] tracking-tight">
                        {row.code}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <ClientTypePills types={row.clientTypes as readonly ClientType[] | undefined} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatKopecks(row.basePrice)}
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                    <Tags className="size-3.5" />
                    <span className="tabular-nums">
                      {row.activeTagCount}
                      {row.activeTagCount !== row.tagCount && (
                        <span className="text-muted-foreground/60">/{row.tagCount}</span>
                      )}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <CategoryActiveToggle id={row._id} isActive={row.isActive} />
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                  {row.sortOrder}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(row)
                      }}
                    >
                      Изменить
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        nextSortOrder={nextSortOrder}
      />
    </div>
  )
}

function CategoriesSkeleton() {
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
