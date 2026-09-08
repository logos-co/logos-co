import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

/** The demo pages are public and worth finding. The routes behind them are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
