'use client'

import { Button } from '@acid-info/logos-ui'
import Link from 'next/link'
import { useState } from 'react'

import { parseBlockSummary } from '@/lib/cryptarchia'
import type { Block } from '@/lib/cryptarchia'

type Result =
  | { kind: 'idle' }
  | { kind: 'block'; block: Block }
  | { kind: 'transaction'; query: string }
  | { kind: 'account'; query: string; balance: string }
  | { kind: 'none'; query: string }

/**
 * Resolves one id against the node.
 *
 * The node has no unified search, so the route tries each lookup in turn. A
 * block is the only kind that resolves today: the testnet is carrying no
 * transactions, so a transaction hash has nothing to match.
 */
export function ChainSearch() {
  const [draft, setDraft] = useState('')
  const [result, setResult] = useState<Result>({ kind: 'idle' })
  const [isSearching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const query = draft.trim()
    if (!query) return

    setSearching(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/chain/search?q=${encodeURIComponent(query)}`,
      )
      const payload = (await response.json()) as Record<string, unknown>

      if (!response.ok) {
        setError(
          typeof payload.error === 'string' ? payload.error : 'Search failed.',
        )
        setResult({ kind: 'idle' })
        return
      }

      if (payload.kind === 'block') {
        const block = parseBlockSummary(payload.block)
        setResult(block ? { kind: 'block', block } : { kind: 'none', query })
      } else if (payload.kind === 'transaction') {
        setResult({ kind: 'transaction', query })
      } else if (payload.kind === 'account') {
        setResult({
          kind: 'account',
          query,
          balance: JSON.stringify(payload.account),
        })
      } else {
        setResult({ kind: 'none', query })
      }
    } catch {
      setError('Search failed.')
      setResult({ kind: 'idle' })
    } finally {
      setSearching(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Block id, transaction hash, or address"
          maxLength={128}
          aria-label="Search the chain"
          className="text-body-sans flex-1 border border-gray-01 bg-white px-3 py-2.5 text-brand-dark-green placeholder:text-gray-04"
        />
        <Button
          type="submit"
          variant="primary"
          icon={false}
          disabled={isSearching || draft.trim().length === 0}
          className="cursor-pointer"
        >
          {isSearching ? 'Searching' : 'Search'}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-caption-sans text-accent-purple">
          {error}
        </p>
      )}

      {result.kind === 'block' && (
        <Link
          href={`/blockchain/block/${result.block.id}`}
          className="flex cursor-pointer flex-col gap-1 border border-gray-01 bg-white p-4 transition-colors hover:bg-accent-light-blue"
        >
          <span className="text-eyebrow text-gray-05">
            Block · slot {result.block.slot}
          </span>
          <span className="text-mono-s break-all text-brand-dark-green">
            {result.block.id}
          </span>
        </Link>
      )}

      {result.kind === 'transaction' && (
        <p className="text-body-sans text-gray-06">
          That is a transaction. Transaction pages are not built yet.
        </p>
      )}

      {result.kind === 'account' && (
        <div className="flex flex-col gap-1 border border-gray-01 bg-white p-4">
          <span className="text-eyebrow text-gray-05">Account</span>
          <span className="text-mono-s break-all text-brand-dark-green">
            {result.balance}
          </span>
        </div>
      )}

      {result.kind === 'none' && (
        <p className="text-body-sans text-gray-05">
          Nothing matches{' '}
          <span className="text-mono-s">{result.query}</span>. The node resolves
          a block id, a transaction hash or an address. The testnet is carrying
          no transactions at the moment, so only block ids find anything.
        </p>
      )}
    </section>
  )
}
