'use client'

import { useEffect, useState } from 'react'

import { CopyButton } from '@/components/copy-button'
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
 * How hard to try for the bytes.
 *
 * A file published a moment ago is not readable immediately, and this page is
 * opened straight after publishing, so it lands in that window. The delays back
 * off to cover roughly eight seconds in total.
 */
const FETCH_ATTEMPTS = 6
const RETRY_BACKOFF_MS = [300, 600, 1200, 2400, 4000]

async function fetchBytes(
  url: string,
  isCancelled: () => boolean
): Promise<Uint8Array> {
  let lastStatus = 0

  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      const wait = RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS.at(-1)!
      await new Promise((resolve) => setTimeout(resolve, wait))
      if (isCancelled()) throw new Error('cancelled')
    }

    /*
     * Retries ask for a slightly different URL.
     *
     * The store sits behind a CDN that caches the 404 it served before the file
     * had propagated, and `no-store` only bypasses the browser's own cache, so
     * every retry to the same URL got that same stale 404 back. A unique query
     * defeats it. The first attempt is left clean so the normal case stays
     * cacheable.
     */
    const target = attempt === 0 ? url : `${url}?retry=${attempt}`

    const response = await fetch(target, { cache: 'no-store' })
    if (response.ok) return new Uint8Array(await response.arrayBuffer())
    lastStatus = response.status
  }

  throw new Error(`fetch returned ${lastStatus}`)
}

/** How much of a text file to show before it stops being a preview. */
const TEXT_PREVIEW_LIMIT = 200_000

/**
 * The file as text, or null if it is not text.
 *
 * A node refuses most text Content-Types, so files published here usually
 * arrive with no recorded type at all and would otherwise be written off as
 * unshowable. Decoding strictly is the test: real UTF-8 text decodes, and
 * anything binary throws. A NUL byte rules out the few binaries that would
 * otherwise slip through.
 */
function asText(bytes: Uint8Array): string | null {
  if (bytes.length > TEXT_PREVIEW_LIMIT) return null
  if (bytes.includes(0)) return null

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
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

  /** Set when the bytes turn out to be readable text. */
  const [text, setText] = useState<string | null>(null)

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
        setText(asText(bytes))

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
    <article className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-label text-gray-05">Shared file</p>
          <h1 className="text-h3-sans break-all text-brand-dark-green">
            {filename}
          </h1>
          <p className="text-body-sans text-gray-05">
            {readableSize(size)} · {mimetype ?? 'no file type recorded'}
          </p>
        </div>
        <DownloadButton filename={filename} url={objectUrl} />
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-label text-gray-05">Preview</h2>
        <div className="flex min-h-40 items-center justify-center border border-gray-01 bg-white p-4">
          <Preview
            cid={cid}
            objectUrl={objectUrl}
            mimetype={rendered}
            text={text}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-label text-gray-05">Integrity</h2>
        <VerificationLine check={check} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-label text-gray-05">Content address</h2>
        <div className="flex items-start gap-2">
          <code className="text-mono-body min-w-0 break-all text-gray-06">
            {cid}
          </code>
          <CopyButton value={cid} label="Copy the content address" />
        </div>
        <p className="text-body-sans text-gray-05">
          A hash of the file itself, so these bytes have this address on any
          Logos Storage node, and no other file can take it.
        </p>
      </section>
    </article>
  )
}

/** What to show in the preview box, in the order a reader would want it. */
function Preview({
  cid,
  objectUrl,
  mimetype,
  text,
}: {
  cid: string
  objectUrl: string | null
  mimetype: string
  text: string | null
}) {
  if (!objectUrl) {
    return <p className="text-body-sans text-gray-05">Fetching the file…</p>
  }

  if (mimetype.startsWith('image/')) {
    return (
      <img src={objectUrl} alt={cid} className="mx-auto max-h-[60vh] w-auto" />
    )
  }

  if (mimetype.startsWith('video/')) {
    return (
      <video src={objectUrl} controls className="mx-auto max-h-[60vh] w-auto" />
    )
  }

  if (mimetype.startsWith('audio/')) {
    return <audio src={objectUrl} controls className="w-full" />
  }

  // Most files published here are text with no recorded type, so showing it
  // beats telling someone their file cannot be shown when it plainly can.
  if (text !== null) {
    return (
      <pre className="text-mono-body max-h-[60vh] w-full overflow-auto whitespace-pre-wrap text-gray-06">
        {text}
      </pre>
    )
  }

  return (
    <p className="text-body-sans text-gray-05">
      This file cannot be shown here. Download it to open it.
    </p>
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
      <span className="text-body-sans shrink-0 text-gray-05">
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
        Re-hashing the file to check it against the address…
      </p>
    )
  }

  if (check.status === 'match') {
    return (
      <p className="text-body-sans text-brand-dark-green">
        Verified. This file hashes to the address in the URL, so it is exactly
        what was published and nothing has altered it since.
      </p>
    )
  }

  if (check.status === 'mismatch') {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-body-sans text-red">
          Does not match. This file does not hash to the address in the URL, so
          it is not what that address names.
        </p>
        <code className="text-mono-body break-all text-gray-06">
          It hashes to {check.computed}
        </code>
      </div>
    )
  }

  return (
    <p className="text-body-sans text-gray-05">
      Could not check the file against its address ({check.reason}).
    </p>
  )
}
