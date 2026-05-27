import { redirect } from 'next/navigation'

// Old /cabinet path — moved to /executor to align with the TMA route. Kept
// as a permanent redirect so any external links / shared screenshots still
// land on the right page.
export default function CabinetRedirect(): never {
  redirect('/executor')
}
