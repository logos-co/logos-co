import { list, put } from '@vercel/blob'
import { NextResponse } from 'next/server'

import {
  blobPathFor,
  blobPrefixFor,
  computeCid,
  isCid,
  MAX_SHARE_BYTES,
} from '@/lib/storage-share'
import { isAcceptedMimetype } from '@/lib/storage-mimetypes'

/**
 * Stores a file so a CID can be opened from outside this tab.
 *
 * This app's own store, not Logos Storage. No public storage node accepts an
 * upload — see docs/storage-research.md — so the network cannot hold this. The
 * CID is still the real one the network would assign, and the read path checks
 * the bytes against it, so the link is content-addressed even though the
 * hosting is ordinary.
 */

export const runtime = 'nodejs'

/** Whether a store is wired up. Read per request, never at build time. */
const isConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)

/**
 * Whether this deployment can publish.
 *
 * The page that asks is statically prerendered, so it cannot read the
 * environment itself: a build-time read is frozen into the HTML, and adding or
 * rotating the token later would not change it until the next build. Asking a
 * route handler moves the question to request time, where the answer is
 * current.
 */
export async function GET() {
  return NextResponse.json(
    { enabled: isConfigured() },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Sharing is not configured in this deployment.' },
      { status: 501 }
    )
  }

  const url = new URL(request.url)
  const claimedCid = url.searchParams.get('cid') ?? ''
  // Absent means the file has no mimetype, which is a state the node has too:
  // it refuses a Content-Type it cannot place, but accepts an upload with none
  // and leaves the manifest field out. Defaulting here instead would recompute
  // a different CID from the one the page sent and reject an honest upload.
  const mimetype = url.searchParams.get('mimetype')
  const filename = url.searchParams.get('filename') || ''

  if (!isCid(claimedCid)) {
    return NextResponse.json(
      { error: 'Not a Logos Storage CID.' },
      { status: 400 }
    )
  }
  if (!filename) {
    return NextResponse.json(
      { error: 'A filename is required.' },
      { status: 400 }
    )
  }

  const body = new Uint8Array(await request.arrayBuffer())
  if (body.length === 0) {
    return NextResponse.json({ error: 'Empty body.' }, { status: 400 })
  }
  if (body.length > MAX_SHARE_BYTES) {
    return NextResponse.json(
      { error: 'That file is too large to share.' },
      { status: 413 }
    )
  }

  // The client computed the CID, so it is not trusted. Recomputing here is what
  // makes the address honest: a caller cannot park arbitrary bytes under a CID
  // that does not describe them.
  const { cid } = await computeCid(body, { filename, mimetype })
  if (cid !== claimedCid) {
    return NextResponse.json(
      { error: 'Those bytes do not hash to that CID.' },
      { status: 422 }
    )
  }

  // Same CID means the same bytes, so anything already there needs no rewrite.
  const existing = await list({ prefix: blobPrefixFor(cid), limit: 1 }).catch(
    () => null
  )
  if (existing?.blobs.length) {
    return NextResponse.json({ cid, url: existing.blobs[0].url })
  }

  const blob = await put(
    blobPathFor(cid, filename, mimetype),
    Buffer.from(body),
    {
      access: 'public',
      // What the browser is served. The manifest's own value travels in the
      // path, so this only affects rendering, never the CID.
      contentType: mimetype ?? 'application/octet-stream',
      addRandomSuffix: false,
    }
  )

  return NextResponse.json({ cid, url: blob.url })
}
