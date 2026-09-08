import type { Metadata } from 'next'

import { OG_IMAGE, SITE_NAME } from '@/lib/site'

import { findDemo } from './registry'

/**
 * Page metadata for one demo, from its registry entry.
 *
 * Keeps the title, the description and the shared card in step with the
 * sidebar and the overview, so a demo is described the same way everywhere.
 */
export function demoMetadata(href: string): Metadata {
  const demo = findDemo(href)
  if (!demo) throw new Error(`No demo registered for ${href}`)

  return {
    title: demo.label,
    description: demo.summary,
    alternates: { canonical: href },
    // Next replaces these objects wholesale rather than merging them into the
    // layout's, so the shared card and its type have to be restated here or a
    // demo link previews as bare text.
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: demo.label,
      description: demo.summary,
      url: href,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: demo.label,
      description: demo.summary,
      images: [OG_IMAGE],
    },
  }
}
