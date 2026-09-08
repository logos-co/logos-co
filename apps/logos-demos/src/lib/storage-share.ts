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

export const blobPathFor = (cid: string) => `logos-demos/content/${cid}`
