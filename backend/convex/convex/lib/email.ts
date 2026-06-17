// Resend sender for the account-merge OTP. Usable only from Convex ACTIONS —
// `fetch` is unavailable in queries/mutations. The better-auth email-OTP path
// in `auth.ts` keeps its own inline copy (it runs inside better-auth's HTTP
// action); this is the standalone version for `merge.ts`'s email-proof flow.
//
// Mirrors the auth.ts behaviour: without RESEND_API_KEY the code is logged
// instead of sent (dev loop), and a failed send throws so the caller knows.
export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string
  subject: string
  text: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'Налоговый помощник <onboarding@resend.dev>'
  if (!apiKey) {
    console.log(`[merge-email] RESEND_API_KEY not set — would send to ${to}:\n${text}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[merge-email] Resend rejected ${to}: ${res.status} ${body}`)
    throw new Error(`Failed to send merge email (${res.status})`)
  }
}
