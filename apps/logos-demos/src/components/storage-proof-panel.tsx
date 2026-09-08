'use client'

import { useEffect, useState } from 'react'

import type { CidBreakdown } from '@/lib/storage-cid'
import { toHex } from '@/lib/storage-cid'
import type { MerkleProof } from '@/lib/storage-proof'
import { merkleProof, verifyProof } from '@/lib/storage-proof'

type Checked = {
  proof: MerkleProof
  holds: boolean
}

/**
 * Proves that one block belongs to the file, without the rest of the file.
 *
 * This is the question a storage network keeps asking a node that is paid to
 * hold something: show me block N. The node answers with that block and a few
 * sibling hashes, and the path folds back to the address the file already has.
 * A node that quietly dropped the block cannot produce it.
 */
export function StorageProofPanel({ breakdown }: { breakdown: CidBreakdown }) {
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState<Checked | null>(null)

  // A new file means new blocks, and the old selection may not exist in it.
  useEffect(() => setIndex(0), [breakdown])

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const leaves = breakdown.levels[0]
      const root = breakdown.levels[breakdown.levels.length - 1][0]
      const proof = merkleProof(breakdown.levels, index)
      const holds = await verifyProof(proof, leaves[index], root)

      if (!cancelled) setChecked({ proof, holds })
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [breakdown, index])

  if (!checked) return null

  return (
    <section className="flex flex-col gap-3 border-t border-gray-01 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-label text-gray-05">Prove one block</h3>
        {breakdown.blockCount > 1 && (
          <label className="text-body-sans flex items-center gap-2 text-gray-05">
            Block
            <select
              value={index}
              onChange={(event) => setIndex(Number(event.target.value))}
              className="text-body-sans cursor-pointer border border-gray-02 bg-white px-2 py-1 text-brand-dark-green"
            >
              {Array.from({ length: breakdown.blockCount }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="text-body-sans text-gray-06">
        {checked.holds
          ? `Block ${index} belongs to this file. Proved with ${checked.proof.path.length} sibling ${checked.proof.path.length === 1 ? 'hash' : 'hashes'} and the block itself, not the other ${breakdown.blockCount - 1}.`
          : `Block ${index} does not prove against this file.`}
      </p>

      <div className="flex flex-col gap-1">
        <span className="text-label text-gray-05">The path</span>
        <ol className="flex flex-wrap gap-1">
          {checked.proof.path.map((step, level) => {
            const hex = toHex(step)
            return (
              <li key={level}>
                <code
                  title={`level ${level}: ${hex}`}
                  className="text-mono-body border border-gray-01 bg-white px-1.5 py-0.5 text-gray-06"
                >
                  {hex.slice(0, 8)}
                </code>
              </li>
            )
          })}
        </ol>
      </div>

      <p className="text-body-sans text-gray-05">
        A node paid to keep this file is asked for a random block and has to
        answer with a path like this. It cannot be produced without the block,
        which is what makes the promise checkable rather than trusted.
      </p>
    </section>
  )
}
