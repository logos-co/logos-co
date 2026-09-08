import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

/**
 * The demo pages are public and worth finding.
 *
 * A shared file is not: `/storage/c/<cid>` is whatever someone happened to
 * publish, and those links are meant to be passed to a person, not indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/storage/c/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
