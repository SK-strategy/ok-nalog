import type { MetadataRoute } from 'next'

import { LEGAL_DOCUMENTS } from '~/views/legal'

// Public routes only. Product pages stay out (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://oknalog.net'
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    ...LEGAL_DOCUMENTS.map((doc) => ({
      url: `${base}/${doc.slug}`,
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),
  ]
}
