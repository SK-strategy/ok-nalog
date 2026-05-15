'use client'

import { useQuery } from 'convex/react'

import { api } from '@fedor/convex'
import { cn, Skeleton } from '@fedor/ui'

export function HomePage() {
  const tasks = useQuery(api.tasks.list)

  return (
    <main
      className={cn('container flex h-screen flex-col items-center justify-center gap-4 py-16')}
    >
      <h1 className="text-4xl font-bold tracking-tight">fedor</h1>
      <p className="text-muted-foreground">fresh turborepo monorepo</p>

      <section className="flex w-full max-w-md flex-col gap-2">
        <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">tasks</h2>

        {tasks === undefined ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-6 w-3/5" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            no tasks yet — create one with{' '}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">api.tasks.create</code>
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tasks.map((task) => (
              <li
                key={task._id}
                className={cn(
                  'rounded border px-3 py-2 text-sm',
                  task.isCompleted && 'text-muted-foreground line-through',
                )}
              >
                {task.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
