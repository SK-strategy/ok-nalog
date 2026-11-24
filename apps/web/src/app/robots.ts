import type { MetadataRoute } from 'next'

// Landing is indexable; product surfaces (orders, cabinets, profile) are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/orders', '/cabinet', '/executor', '/profile'],
    },
    sitemap: 'https://oknalog.net/sitemap.xml',
  }
}
