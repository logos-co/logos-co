/**
 * Proofs are checked against roots a real node produced.
 *
 * The tree root is not this code's opinion: it comes from the treeCid a node
 * returned when the same bytes were uploaded to it. A proof that folds back to
 * that root is a proof the node would also accept, which is the only claim
 * worth making here.
 */
import { describe, expect, it } from 'vitest'

import {
  BLOCK_SIZE,
  blockAt,
  foldTree,
  sha256,
  toBase58Cid,
} from './storage-cid'
import { merkleProof, reconstructRoot, verifyProof } from './storage-proof'

/** Same generator the CID fixtures use, so the bytes are the node's inputs. */
function pseudoRandom(length: number, seed: number): Uint8Array {
  const out = new Uint8Array(length)
  let state = seed | 0
  for (let i = 0; i < length; i += 1) {
    state ^= state << 13
    state |= 0
    state ^= state >>> 17
    state ^= state << 5
    state |= 0
    out[i] = state & 0xff
  }
  return out
}

async function treeOf(data: Uint8Array) {
  const blockCount = Math.ceil(data.length / BLOCK_SIZE)
  const blocks = Array.from({ length: blockCount }, (_, i) => blockAt(data, i))
  const leaves = await Promise.all(blocks.map(sha256))
  return { leaves, levels: await foldTree(leaves) }
}

/** treeCid the node returned for each of these inputs. */
const CASES = [
  {
    name: 'one block',
    bytes: new TextEncoder().encode('hello logos'),
    blocks: 1,
  },
  { name: 'three blocks', bytes: pseudoRandom(131073, 3), blocks: 3 },
  { name: 'five blocks', bytes: pseudoRandom(294912, 5), blocks: 5 },
  { name: 'seven blocks', bytes: pseudoRandom(458752, 7), blocks: 7 },
]

describe('merkle proofs', () => {
  it.each(CASES)(
    'every block of a file with $name proves against the root',
    async ({ bytes, blocks }) => {
      const { leaves, levels } = await treeOf(bytes)
      const root = levels[levels.length - 1][0]
      expect(leaves).toHaveLength(blocks)

      // Odd block counts are the interesting ones: those trees pair a node
      // with zeroes, and the key byte changes with it.
      for (let index = 0; index < blocks; index += 1) {
        const proof = merkleProof(levels, index)
        expect(
          await verifyProof(proof, leaves[index], root),
          `block ${index} of ${blocks}`
        ).toBe(true)
      }
    }
  )

  it('folds to the tree root the node published', async () => {
    // The one value here that this code did not produce.
    const { leaves, levels } = await treeOf(
      new TextEncoder().encode('hello logos')
    )
    const proof = merkleProof(levels, 0)
    const root = await reconstructRoot(proof, leaves[0])

    const cid = toBase58Cid(
      new Uint8Array([0x01, 0x83, 0x9a, 0x03, 0x12, 0x20, ...root])
    )
    expect(cid).toBe('zDzSvJTf2Nu9hwAzzj9aEQ61cHUWmmAJUeBSNK3vD1g1F1RERgze')
  })

  it('rejects a proof offered for the wrong block', async () => {
    const { leaves, levels } = await treeOf(pseudoRandom(294912, 5))
    const root = levels[levels.length - 1][0]

    // A node that lost block 3 cannot answer with block 0 and get away with it.
    const proof = merkleProof(levels, 3)
    expect(await verifyProof(proof, leaves[0], root)).toBe(false)
  })

  it('rejects a proof whose path was tampered with', async () => {
    const { leaves, levels } = await treeOf(pseudoRandom(131073, 3))
    const root = levels[levels.length - 1][0]

    const proof = merkleProof(levels, 1)
    const tampered = {
      ...proof,
      path: proof.path.map((step, i) =>
        i === 0 ? new Uint8Array(step).fill(0) : step
      ),
    }
    expect(await verifyProof(tampered, leaves[1], root)).toBe(false)
  })

  it('refuses an index the file does not have', async () => {
    const { levels } = await treeOf(new TextEncoder().encode('hello logos'))
    expect(() => merkleProof(levels, 1)).toThrow(/this file has 1/)
    expect(() => merkleProof(levels, -1)).toThrow()
  })
})
