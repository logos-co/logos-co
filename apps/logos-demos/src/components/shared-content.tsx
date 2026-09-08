'use client'

import { useEffect, useState } from 'react'

import { computeCid } from '@/lib/storage-cid'

type Props = {
  cid: string
  url: string
  /** Recovered from the stored path. It is a manifest field, so the CID needs it. */
  filename: string | null
  size: number
}

type Check =
  | { status: 'checking' }
  | { status: 'match' }
  | { status: 'mismatch'; computed: string }
  | { status: 'failed'; reason: string }

const readableSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`

/**
 * Shows the file and re-derives its CID from what actually arrived.
 *
 * This is the part an ordinary file link cannot do. The address is a hash, so
 * the viewer does not have to trust the host: if a byte changed, the CID would
 * no longer be the one in the URL, and this says so.
 */
export function SharedContent({ cid, url, filename, size }: Props) {
  const [check, setCheck] = useState<Check>({ status: 'checking' })
  const [mimetype, setMimetype] = useState('application/octet-stream')

  useEffect(() => {
    let cancelled = false

    const verify = async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`fetch returned ${response.status}`)

        const bytes = new Uint8Array(await response.arrayBuffer())

        // The mimetype is a manifest field too, so it has to be the one the
        // file was published with. The store echoes it back on the response;
        // the filename comes from the stored path, via the `filename` prop.
        const served =
          response.headers.get('content-type') ?? 'application/octet-stream'
        if (cancelled) return
        setMimetype(served)

        const { cid: computed } = await computeCid(bytes, {
          filename,
          mimetype: served,
        })
        if (cancelled) return

        setCheck(
          computed === cid
            ? { status: 'match' }
            : { status: 'mismatch', computed }
        )
      } catch (cause) {
        if (cancelled) return
        setCheck({
          status: 'failed',
          reason: cause instanceof Error ? cause.message : 'unknown error',
        })
      }
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [cid, url, filename])

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-gray-01 bg-white p-4">
        {mimetype.startsWith('image/') ? (
          /* Plain <img>: the blob URL is off this origin and the bytes must
             arrive unaltered for the CID check below to mean anything. */
          <img src={url} alt={cid} className="mx-auto max-h-[60vh] w-auto" />
        ) : mimetype.startsWith('video/') ? (
          <video src={url} controls className="mx-auto max-h-[60vh] w-auto" />
        ) : mimetype.startsWith('audio/') ? (
          <audio src={url} controls className="w-full" />
        ) : (
          <p className="text-body-sans text-gray-06">
            {mimetype} · {readableSize(size)}. Nothing to render inline.
          </p>
        )}
      </div>

      <VerificationLine check={check} />
    </div>
  )
}

function VerificationLine({ check }: { check: Check }) {
  if (check.status === 'checking') {
    return (
      <p className="text-body-sans text-gray-05">
        Re-hashing what arrived, to check it against the CID…
      </p>
    )
  }

  if (check.status === 'match') {
    return (
      <p className="text-body-sans text-brand-dark-green">
        These bytes hash to the CID in the URL. The address describes what you
        are looking at.
      </p>
    )
  }

  if (check.status === 'mismatch') {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-body-sans text-red">
          These bytes do not hash to the CID in the URL.
        </p>
        <code className="text-mono-s break-all text-gray-06">
          {check.computed}
        </code>
      </div>
    )
  }

  return (
    <p className="text-body-sans text-gray-05">
      Could not check the bytes against the CID ({check.reason}).
    </p>
  )
}
