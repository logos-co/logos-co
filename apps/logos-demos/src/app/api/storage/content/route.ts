import { head, put } from '@vercel/blob'
import { NextResponse } from 'next/server'

import {
  computeCid,
  MAX_SHARE_BYTES,
  blobPathFor,
  isCid,
} from '@/lib/storage-share'

/**
 * Stores a file so a CID can be opened from outside this tab.
 *
 * This app's own store, not Logos Storage. No public storage node accepts an
 * upload — see docs/storage-research.md — so the network cannot hold this. The
 * CID is still the real one the network would assign, and the read path checks
 * the bytes against it, so the link is content-addressed even though the
 * hosting is ordinary.
 *
 * The CID is the key, which makes writes idempotent: the same file published
 * twice lands on the same object.
 */

export const runtime = 'nodejs'

const configured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)

export async function POST(request: Request) {
  if (!configured()) {
    return NextResponse.json(
      { error: 'Sharing is not configured in this deployment.' },
      { status: 501 }
    )
  }

  const url = new URL(request.url)
  const claimedCid = url.searchParams.get('cid') ?? ''
  const mimetype =
    url.searchParams.get('mimetype') || 'application/octet-stream'
  const filename = url.searchParams.get('filename') || null

  if (!isCid(claimedCid)) {
    return NextResponse.json(
      { error: 'Not a Logos Storage CID.' },
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

  const pathname = blobPathFor(cid)

  // Same CID, same bytes, so an existing object needs no rewrite.
  const existing = await head(pathname).catch(() => null)
  if (existing) {
    return NextResponse.json({ cid, url: existing.url })
  }

  const blob = await put(pathname, Buffer.from(body), {
    access: 'public',
    contentType: mimetype,
    addRandomSuffix: false,
  })

  return NextResponse.json({ cid, url: blob.url })
}
