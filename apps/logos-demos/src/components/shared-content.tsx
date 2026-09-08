'use client'

import { useEffect, useState } from 'react'

import { computeCid } from '@/lib/storage-cid'

type Props = {
  cid: string
  url: string
  /** Recovered from the stored path. Both are manifest fields the CID needs. */
  filename: string
  mimetype: string | null
  size: number
}

type Check =
  | { status: 'checking' }
  | { status: 'match' }
  | { status: 'mismatch'; computed: string }
  | { status: 'failed'; reason: string }

/**
 * How many times to ask for the bytes, and how long to wait between tries.
 *
 * A file published a moment ago is not always readable yet, and a link opened
 * straight after publishing lands in that window. One attempt would report an
 * intact file as unverifiable.
 */
const FETCH_ATTEMPTS = 5
const RETRY_MS = 500

async function fetchBytes(
  url: string,
  isCancelled: () => boolean
): Promise<Uint8Array> {
  let lastStatus = 0

  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
      if (isCancelled()) throw new Error('cancelled')
    }

    // `no-store`, because a 404 from the moment before publication landed can
    // otherwise be served from cache for the whole retry window.
    const response = await fetch(url, { cache: 'no-store' })
    if (response.ok) return new Uint8Array(await response.arrayBuffer())
    lastStatus = response.status
  }

  throw new Error(`fetch returned ${lastStatus}`)
}

const readableSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`

/**
 * Shows the file and re-derives its CID from what actually arrived.
 *
 * This is the part an ordinary file link cannot do. The address is a hash, so
 * the viewer does not have to trust the host: if a byte changed, the CID would
 * no longer be the one in the URL, and this says so.
 */
export function SharedContent({ cid, url, filename, mimetype, size }: Props) {
  const [check, setCheck] = useState<Check>({ status: 'checking' })

  /**
   * A local URL for the bytes, used to show the file and to save it.
   *
   * Everything on this page comes from one download: what you see, what the
   * check ran against, and what the button saves are provably the same bytes.
   * It also has to be local for saving, because the store is another origin
   * where `download` is ignored and the browser navigates instead.
   */
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  // What to render as. The manifest's mimetype can be absent, and the file is
  // still worth showing, so fall back to what the store serves it as.
  const rendered = mimetype ?? 'application/octet-stream'

  useEffect(() => {
    let cancelled = false

    const verify = async () => {
      try {
        const bytes = await fetchBytes(url, () => cancelled)

        // Both manifest fields come from the stored path rather than from the
        // response, because the store does not return the Content-Type it was
        // given and never carried the filename at all.
        const { cid: computed } = await computeCid(bytes, {
          filename,
          mimetype,
        })
        if (cancelled) return

        setObjectUrl(
          URL.createObjectURL(new Blob([bytes as BlobPart], { type: rendered }))
        )

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
  }, [cid, url, filename, mimetype, rendered])

  // Nothing else releases an object URL, and this component outlives the fetch.
  useEffect(() => {
    if (!objectUrl) return
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-gray-01 bg-white p-4">
        {!objectUrl ? (
          <p className="text-body-sans text-gray-05">Fetching the file…</p>
        ) : rendered.startsWith('image/') ? (
          <img
            src={objectUrl}
            alt={cid}
            className="mx-auto max-h-[60vh] w-auto"
          />
        ) : rendered.startsWith('video/') ? (
          <video
            src={objectUrl}
            controls
            className="mx-auto max-h-[60vh] w-auto"
          />
        ) : rendered.startsWith('audio/') ? (
          <audio src={objectUrl} controls className="w-full" />
        ) : (
          <p className="text-body-sans text-gray-05">
            Nothing to show inline for this file type. It can still be saved.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-body-sans break-all text-gray-06">
          {filename} · {readableSize(size)}
        </span>
        <DownloadButton filename={filename} url={objectUrl} />
      </div>

      <VerificationLine check={check} />
    </div>
  )
}

/**
 * Saves the file under the name it was published with.
 *
 * Disabled until the bytes are here, because the link is built from them. That
 * is deliberate: the file you save is the one that was just checked against the
 * CID, not a second fetch that could return something else.
 */
function DownloadButton({
  filename,
  url,
}: {
  filename: string
  url: string | null
}) {
  if (!url) {
    return (
      <span className="text-caption-sans shrink-0 text-gray-05">
        Preparing download…
      </span>
    )
  }

  return (
    <a
      href={url}
      download={filename}
      className="text-body-sans shrink-0 cursor-pointer border border-gray-02 bg-white px-3 py-1.5 text-brand-dark-green no-underline hover:bg-gray-00"
    >
      Download
    </a>
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
