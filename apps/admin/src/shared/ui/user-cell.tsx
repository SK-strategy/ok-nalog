import { Avatar, AvatarFallback, AvatarImage } from '@tax-assistant/ui/avatar'

interface UserCellProps {
  name: string
  username?: string | null
  image?: string | null
}

/** Avatar + name + @username column — used in users / executors tables. */
export function UserCell({ name, username, image }: UserCellProps) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-9">
        {image ? <AvatarImage src={image} alt={name} /> : null}
        <AvatarFallback className="text-xs font-medium">{initials || '?'}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{name}</span>
        {username && <span className="text-muted-foreground truncate text-xs">@{username}</span>}
      </div>
    </div>
  )
}
