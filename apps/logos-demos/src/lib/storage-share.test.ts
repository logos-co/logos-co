/**
 * The CID guard is what keeps a caller from choosing where bytes land.
 *
 * `blobPathFor` interpolates the CID into a storage path, so anything that
 * reaches it has to be a CID and nothing else.
 */
import { describe, expect, it } from 'vitest'

import { blobPathFor, metadataFromBlobPath, isCid } from './storage-share'

const REAL_CID = 'zDvZRwzm1XSHX9H19xAyPoetd9JwN4iKAmk5DKcMdu5wy9kNrYzj'

describe('isCid', () => {
  it('accepts a manifest CID the node printed', () => {
    expect(isCid(REAL_CID)).toBe(true)
  })

  it('rejects attempts to walk out of the prefix', () => {
    expect(isCid('../../etc/passwd')).toBe(false)
    expect(isCid(`${REAL_CID}/../secret`)).toBe(false)
    expect(isCid(`../${REAL_CID}`)).toBe(false)
  })

  it('rejects characters base58 does not use', () => {
    // 0, O, I and l are excluded from the alphabet precisely to avoid
    // look-alikes, so a CID containing them was not produced by the node.
    expect(isCid(REAL_CID.replace('X', '0'))).toBe(false)
    expect(isCid(`${REAL_CID.slice(0, -1)}O`)).toBe(false)
  })

  it('rejects the empty string and other prefixes', () => {
    expect(isCid('')).toBe(false)
    expect(isCid('QmYwAPJzv5CZsnAzt8auVZRn1RtScxdEEsWDaFnDxU3Hoo')).toBe(false)
  })

  it('keeps every CID inside one prefix', () => {
    expect(blobPathFor(REAL_CID, 'a.png', 'image/png')).toBe(
      `logos-demos/content/${REAL_CID}/image%2Fpng/a.png`
    )
  })
})

describe('manifest fields in the stored path', () => {
  // Both are manifest fields, so both are part of the CID. If either did not
  // survive storage exactly, the shared page would re-derive a different CID
  // and report a mismatch on a file that is perfectly intact.
  it.each([
    'hello.txt',
    'a file with spaces.png',
    'ünïcödé.jpg',
    'slash/in/name.bin',
    '..',
    'percent%20already.txt',
    'quote"and#hash.gif',
  ])('round-trips the filename %j', (filename) => {
    const path = blobPathFor(REAL_CID, filename, 'image/png')
    expect(metadataFromBlobPath(path)).toEqual({
      filename,
      mimetype: 'image/png',
    })
  })

  it.each(['image/png', 'text/plain', 'application/vnd.ms-excel', null])(
    'round-trips the mimetype %j',
    (mimetype) => {
      const path = blobPathFor(REAL_CID, 'a.bin', mimetype)
      expect(metadataFromBlobPath(path)?.mimetype).toBe(mimetype)
    }
  )

  it('cannot confuse a real mimetype with the no-mimetype marker', () => {
    // Every mimetype has a slash, which encodes, so none can spell `none`.
    expect(blobPathFor(REAL_CID, 'a.bin', 'x/none')).toContain('x%2Fnone')
    expect(
      metadataFromBlobPath(blobPathFor(REAL_CID, 'a.bin', 'x/none'))
    ).toEqual({ filename: 'a.bin', mimetype: 'x/none' })
  })

  it('keeps a name with slashes inside the CID prefix', () => {
    // Otherwise a name could invent path segments and land elsewhere.
    const path = blobPathFor(REAL_CID, '../../escape.txt', 'text/plain')
    expect(path.startsWith(`logos-demos/content/${REAL_CID}/`)).toBe(true)
    expect(path.split('/')).toHaveLength(5)
  })
})
