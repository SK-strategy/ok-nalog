import { cn, Skeleton } from '@fedor/ui'

export function HomePage() {
  return (
    <main
      className={cn('container flex h-screen flex-col items-center justify-center gap-4 py-16')}
    >
      <h1 className="text-4xl font-bold tracking-tight">fedor</h1>
      <p className="text-muted-foreground">fresh turborepo monorepo</p>
    </main>
  )
}
