/**
 * The CID guard is what keeps a caller from choosing where bytes land.
 *
 * `blobPathFor` interpolates the CID into a storage path, so anything that
 * reaches it has to be a CID and nothing else.
 */
import { describe, expect, it } from 'vitest'

import { blobPathFor, filenameFromBlobPath, isCid } from './storage-share'

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
    expect(blobPathFor(REAL_CID, 'a.png')).toBe(
      `logos-demos/content/${REAL_CID}/a.png`,
    )
  })
})

describe('filenames in the stored path', () => {
  // The filename is a manifest field, so it is part of the CID. If it did not
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
  ])('round-trips %j', (filename) => {
    const path = blobPathFor(REAL_CID, filename)
    expect(filenameFromBlobPath(path)).toBe(filename)
  })

  it('keeps a name with slashes inside the CID prefix', () => {
    // Otherwise a name could invent path segments and land elsewhere.
    const path = blobPathFor(REAL_CID, '../../escape.txt')
    expect(path.startsWith(`logos-demos/content/${REAL_CID}/`)).toBe(true)
    expect(path.split('/')).toHaveLength(4)
  })
})
