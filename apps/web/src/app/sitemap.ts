import type { MetadataRoute } from 'next'

// Public routes only. Product pages stay out (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://oknalog.net'
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/oferta`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/politika`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/soglasie`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
