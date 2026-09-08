import { list } from '@vercel/blob'
import type { Metadata } from 'next'
import Link from 'next/link'

import { SharedContent } from '@/components/shared-content'
import { blobPrefixFor, filenameFromBlobPath, isCid } from '@/lib/storage-share'

/**
 * Opens a file by its Logos Storage CID.
 *
 * The URL is the content's address, so the page can do something an ordinary
 * file link cannot: fetch the bytes, hash them, and show whether they still
 * match the name they are served under.
 */

type Props = { params: Promise<{ cid: string }> }

export const metadata: Metadata = {
  title: 'Shared content — Logos Demos',
}

/** The one object stored under a CID, with the filename its path carries. */
async function findPublished(cid: string) {
  if (!isCid(cid) || !process.env.BLOB_READ_WRITE_TOKEN) return null

  const found = await list({ prefix: blobPrefixFor(cid), limit: 1 }).catch(
    () => null
  )
  const blob = found?.blobs[0]
  if (!blob) return null

  return {
    url: blob.url,
    size: blob.size,
    filename: filenameFromBlobPath(blob.pathname),
  }
}

export default async function SharedContentPage({ params }: Props) {
  const { cid } = await params
  const published = await findPublished(cid)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <span className="text-eyebrow text-gray-05">
          Logos Storage · content address
        </span>
        <code className="text-mono-s break-all text-gray-06">{cid}</code>
      </div>

      {published ? (
        <SharedContent
          cid={cid}
          url={published.url}
          filename={published.filename}
          size={published.size}
        />
      ) : (
        <p className="text-body-sans text-gray-06">
          {isCid(cid)
            ? 'Nothing is published under that CID here.'
            : 'That is not a Logos Storage CID.'}
        </p>
      )}

      <p className="text-caption-sans text-gray-05">
        The CID is the one Logos Storage would give this file, computed to the
        network&rsquo;s own spec. The bytes are served from this app&rsquo;s
        store rather than the network, because no public Logos Storage node
        accepts uploads.{' '}
        <Link href="/storage" className="underline">
          See how the CID is worked out
        </Link>
        .
      </p>
    </main>
  )
}
