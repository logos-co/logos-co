import { list } from '@vercel/blob'
import type { Metadata } from 'next'
import Link from 'next/link'

import { SharedContent } from '@/components/shared-content'
import { blobPrefixFor, metadataFromBlobPath, isCid } from '@/lib/storage-share'

/**
 * Opens a file by its Logos Storage CID.
 *
 * The URL is the content's address, so the page can do something an ordinary
 * file link cannot: fetch the bytes, hash them, and show whether they still
 * match the name they are served under.
 */

type Props = { params: Promise<{ cid: string }> }

export const metadata: Metadata = {
  title: 'Shared content',
  description:
    'A file opened by its Logos Storage content address, checked against the CID in the URL.',
  // Whatever someone published is theirs to pass on, not something to index.
  robots: { index: false, follow: false },
}

/** The one object stored under a CID, with the manifest fields its path carries. */
async function findPublished(cid: string) {
  if (!isCid(cid) || !process.env.BLOB_READ_WRITE_TOKEN) return null

  const found = await list({ prefix: blobPrefixFor(cid), limit: 1 }).catch(
    () => null
  )
  const blob = found?.blobs[0]
  if (!blob) return null

  const metadata = metadataFromBlobPath(blob.pathname)
  if (!metadata) return null

  return { url: blob.url, size: blob.size, ...metadata }
}

export default async function SharedContentPage({ params }: Props) {
  const { cid } = await params
  const published = await findPublished(cid)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6 py-12">
      {published ? (
        <SharedContent
          cid={cid}
          url={published.url}
          filename={published.filename}
          mimetype={published.mimetype}
          size={published.size}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <h1 className="text-h3-sans text-brand-dark-green">
            {isCid(cid) ? 'Nothing here' : 'Not an address'}
          </h1>
          <p className="text-body-sans text-gray-06">
            {isCid(cid)
              ? 'That is a valid Logos Storage address, but nothing has been published under it here.'
              : 'That is not a Logos Storage content address.'}
          </p>
          <code className="text-mono-body break-all text-gray-05">{cid}</code>
        </div>
      )}

      <p className="text-body-sans border-t border-gray-01 pt-6 text-gray-05">
        The address above is the one Logos Storage would give this file,
        computed to the network&rsquo;s own spec. The file itself is served from
        this app&rsquo;s store rather than the network, because no public Logos
        Storage node accepts uploads.{' '}
        <Link href="/storage" className="underline">
          See how the address is worked out
        </Link>
        .
      </p>
    </main>
  )
}
