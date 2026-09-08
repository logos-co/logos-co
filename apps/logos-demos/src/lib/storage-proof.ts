/**
 * Merkle proofs, the shape Logos Storage uses to prove it still holds a file.
 *
 * A node that stores a file is asked, at random, to show one block. It answers
 * with that block and a short path of sibling hashes, and anyone holding the
 * root can check the two fold together. The point is what it does not require:
 * the rest of the file, the node's honesty, or a trusted third party.
 *
 * Ported from `getProof` and `reconstructRoot` in logos-storage/nim-merkletree,
 * which is what the node itself runs. Pure computation, so a browser can do all
 * of it. See docs/storage-cid.md.
 */

import { compress, KEY_BOTTOM, KEY_NONE, ZERO } from './storage-cid'

export type MerkleProof = {
  /** Which block this proves. */
  index: number
  /** How many blocks the file has, which the fold depends on. */
  leafCount: number
  /** One sibling per level, bottom first. */
  path: Uint8Array[]
}

/**
 * The sibling hashes needed to re-fold one leaf into the root.
 *
 * A level with an odd count has no sibling for its last node, and the tree
 * pairs that node with zeroes, so the path carries zeroes in the same places.
 */
export function merkleProof(
  levels: Uint8Array[][],
  index: number
): MerkleProof {
  const leafCount = levels[0].length
  if (!Number.isInteger(index) || index < 0 || index >= leafCount) {
    throw new Error(`No block ${index}: this file has ${leafCount}.`)
  }

  const path: Uint8Array[] = []
  let position = index
  let width = leafCount

  // The root is not a sibling of anything, so it is not on the path.
  for (let level = 0; level < levels.length - 1; level += 1) {
    const sibling = position ^ 1
    path.push(sibling < width ? levels[level][sibling] : ZERO)

    position >>= 1
    width = (width + 1) >> 1
  }

  return { index, leafCount, path }
}

/**
 * Fold a leaf back up its path and return the root it implies.
 *
 * The key byte has to be reproduced exactly as the tree built it, including
 * the odd-node case, or an honest proof reconstructs the wrong root.
 */
export async function reconstructRoot(
  proof: MerkleProof,
  leaf: Uint8Array
): Promise<Uint8Array> {
  let hash = leaf
  let position = proof.index
  let width = proof.leafCount
  let bottom = KEY_BOTTOM

  for (const sibling of proof.path) {
    if (position % 2 === 1) {
      // An odd index means this leaf is the right child, so it cannot itself
      // be the odd one out.
      hash = await compress(sibling, hash, bottom)
    } else if (position === width - 1) {
      // Last node of a level with an odd count: paired with zeroes, and marked.
      hash = await compress(hash, sibling, bottom + 2)
    } else {
      hash = await compress(hash, sibling, bottom)
    }

    bottom = KEY_NONE
    position >>= 1
    width = (width + 1) >> 1
  }

  return hash
}

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((byte, i) => byte === b[i])

/** Whether this proof shows the leaf belongs to the file with this root. */
export async function verifyProof(
  proof: MerkleProof,
  leaf: Uint8Array,
  root: Uint8Array
): Promise<boolean> {
  return sameBytes(await reconstructRoot(proof, leaf), root)
}
