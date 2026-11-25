import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { LegalDocument } from '../model/documents'

const CONTENT_DIR = path.join(process.cwd(), 'src/views/legal/content')

/**
 * Shared legal-document page: title, typographed markdown body (headings,
 * tables, lists), «На главную» link. RSC — the markdown is read at request
 * time (root layout is force-dynamic, so no build-time fs dependency).
 */
export async function LegalDocumentPage({ doc }: { doc: LegalDocument }) {
  const markdown = await readFile(path.join(CONTENT_DIR, doc.file), 'utf8')

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="text-text-soft hover:text-foreground focus-visible:ring-ring/50 rounded-sm
          text-sm outline-none focus-visible:ring-[3px]"
      >
        ← На главную
      </Link>
      <h1 className="text-foreground mt-4 text-2xl font-bold tracking-tight">{doc.title}</h1>
      <article
        className="text-text-soft [&_a]:text-primary [&_blockquote]:border-separator-strong
          [&_em]:text-hint [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground
          [&_strong]:text-foreground [&_td]:border-separator [&_th]:border-separator
          [&_th]:bg-secondary [&_th]:text-foreground mt-6 text-[15px] leading-relaxed
          [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-4
          [&_h1]:mt-8 [&_h1]:mb-3 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:mb-3
          [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-bold
          [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_table]:my-4
          [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:px-3
          [&_td]:py-2 [&_td]:align-top [&_th]:border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left
          [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>
    </main>
  )
}
