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
 * The filename is part of the manifest, so it is part of the CID: the same
 * bytes under a different name have a different address. It has to survive the
 * round trip or the reader cannot re-derive the CID, and Vercel Blob has no
 * metadata field to put it in — so it is carried in the path, encoded, and
 * decoded back on read. Encoding also stops a name introducing path segments.
 */
export const blobPathFor = (cid: string, filename: string) =>
  `${blobPrefixFor(cid)}${encodeURIComponent(filename)}`

/** The filename a `blobPathFor` path was built from. */
export function filenameFromBlobPath(pathname: string): string | null {
  const segment = pathname.split('/').pop()
  if (!segment) return null
  try {
    return decodeURIComponent(segment)
  } catch {
    // A malformed escape means this path was not written by `blobPathFor`.
    return null
  }
}
