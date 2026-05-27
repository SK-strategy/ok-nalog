import type { LucideIcon } from 'lucide-react'
import { Briefcase, FileText, Home, ScrollText } from 'lucide-react'

// Backend categories are admin-managed; the design ships 4 hand-picked tile
// styles. Cycle through them by sortOrder so any number of categories renders
// with a coherent palette without per-row admin config.
//
// Lives in shared so any layer can call it without a forbidden entity↔entity
// cross-import (Steiger / FSD rule).
const PALETTE = [
  { fg: '#2f7ce8', bg: '#e6f0fd', icon: ScrollText },
  { fg: '#1a8f4b', bg: '#def4e4', icon: Briefcase },
  { fg: '#7c4dff', bg: '#ece3ff', icon: FileText },
  { fg: '#d97706', bg: '#fdf1d6', icon: Home },
] as const satisfies readonly { fg: string; bg: string; icon: LucideIcon }[]

type Style = (typeof PALETTE)[number]

export function categoryStyle(sortOrder: number): Style {
  const idx = ((sortOrder % PALETTE.length) + PALETTE.length) % PALETTE.length
  return PALETTE[idx] ?? PALETTE[0]
}
