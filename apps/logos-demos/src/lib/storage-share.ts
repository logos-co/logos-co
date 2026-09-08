/**
 * Shared pieces for publishing content under its Logos Storage CID.
 *
 * The store is this app's own. Logos Storage cannot hold it: no public node
 * accepts an upload, and a browser has no transport to reach one anyway. What
 * carries over from the real thing is the address — the CID is computed to the
 * network's spec, so the same file has the same link here as it would there.
 */

export { computeCid } from './storage-cid'

/**
 * Cap for a shared file.
 *
 * Deliberately small. This is a demonstration of content addressing, not a
 * file host, and the point lands as well with a picture as with a video.
 */
export const MAX_SHARE_BYTES = 4 * 1024 * 1024

/**
 * Manifest CIDs print as `zDv…` in base58btc.
 *
 * Checked before the CID reaches a storage path, so a caller cannot use it to
 * walk out of the prefix.
 */
export const isCid = (value: string): boolean =>
  /^zD[A-HJ-NP-Za-km-z1-9]{40,70}$/.test(value)

/** Everything published under one CID lives here. */
export const blobPrefixFor = (cid: string) => `logos-demos/content/${cid}/`

/**
 * A file with no mimetype is a real state, not a missing value: a node refuses
 * a Content-Type it cannot map to an extension, but accepts an upload with
 * none and records nothing in that field.
 *
 * A mimetype always contains a slash, which encodes to `%2F`, so no encoded
 * mimetype can collide with this marker.
 */
const NO_MIMETYPE = 'none'

/**
 * Where one published file lives.
 *
 * Both the filename and the mimetype are manifest fields, so both are part of
 * the CID. They have to survive the round trip exactly or a reader re-derives a
 * different CID and calls an intact file corrupt. Vercel Blob has no metadata
 * to put them in and does not return the Content-Type it was given, so they are
 * carried in the path. Encoding also stops either introducing path segments.
 */
export const blobPathFor = (
  cid: string,
  filename: string,
  mimetype: string | null
) =>
  `${blobPrefixFor(cid)}${mimetype ? encodeURIComponent(mimetype) : NO_MIMETYPE}/${encodeURIComponent(filename)}`

export type PublishedMetadata = {
  filename: string
  mimetype: string | null
}

/** The manifest fields a `blobPathFor` path was built from. */
export function metadataFromBlobPath(
  pathname: string
): PublishedMetadata | null {
  const segments = pathname.split('/')
  if (segments.length < 2) return null

  const [rawMimetype, rawFilename] = segments.slice(-2)
  if (!rawMimetype || !rawFilename) return null

  try {
    return {
      mimetype:
        rawMimetype === NO_MIMETYPE ? null : decodeURIComponent(rawMimetype),
      filename: decodeURIComponent(rawFilename),
    }
  } catch {
    // A malformed escape means this path was not written by `blobPathFor`.
    return null
  }
}
