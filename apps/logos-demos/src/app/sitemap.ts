import type { MetadataRoute } from 'next'

import { DEMOS } from '@/demos/registry'
import { SITE_URL } from '@/lib/site'

/**
 * The overview and one entry per demo, taken from the registry so a new demo
 * appears here without anyone remembering to add it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'monthly', priority: 1 },
    ...DEMOS.map((demo) => ({
      url: `${SITE_URL}${demo.href}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
