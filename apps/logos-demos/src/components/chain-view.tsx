'use client'

import { useEffect, useState } from 'react'

import { useChain } from '@/components/use-chain'
import type { NodeStatus } from '@/lib/cryptarchia'
import {
  finalityGap,
  formatAge,
  nodesAgree,
  readLiveness,
  shortenHash,
} from '@/lib/cryptarchia'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-eyebrow text-gray-05">{label}</dt>
      <dd className="text-h4-sans break-all text-brand-dark-green">{value}</dd>
    </div>
  )
}

/**
 * Whether the chain is producing.
 *
 * The nodes report `state: "Online"` whether or not blocks are being made, so
 * this watches the height across polls instead of trusting that field.
 */
function Liveness({
  height,
  heightChangedAt,
}: {
  height: number | null
  heightChangedAt: number | null
}) {
  // The age ticks against the clock, so it waits for mount to keep the server
  // and client markup identical.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  if (now === null || heightChangedAt === null) return null

  const liveness = readLiveness(height, now - heightChangedAt)
  if (liveness.state === 'unknown') return null

  const isAdvancing = liveness.state === 'advancing'

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span
        aria-hidden
        className={`size-2.5 rounded-full ${
          isAdvancing ? 'animate-pulse bg-accent-steel-teal' : 'bg-accent-brown'
        }`}
      />
      <span className="text-body-sans text-brand-dark-green">
        {isAdvancing ? 'Producing blocks' : 'Height is not moving'}
      </span>
      <span className="text-caption-sans text-gray-05">
        height last changed {formatAge(liveness.sinceMs)}
      </span>
    </div>
  )
}

function NodeCard({ node }: { node: NodeStatus }) {
  return (
    <article className="flex flex-col gap-3 border border-gray-01 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-h4-sans text-brand-dark-green">{node.label}</span>
        <span className="text-caption-sans text-gray-05">
          {node.state} · {node.phase}
        </span>
      </div>
      <dl className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-eyebrow text-gray-05">Peer id</dt>
          <dd className="text-mono-s break-all text-gray-06">
            {shortenHash(node.peerId)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-eyebrow text-gray-05">Connected peers</dt>
          <dd className="text-mono-s text-gray-06">
            {node.connectedPeers.length}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-eyebrow text-gray-05">Tip</dt>
          <dd className="text-mono-s break-all text-gray-06">
            {shortenHash(node.tip)}
          </dd>
        </div>
      </dl>
    </article>
  )
}

export function ChainView() {
  const { view, heightChangedAt, isLoading, error } = useChain()
  const lead = view?.nodes[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="text-caption-sans text-accent-purple">
          {error}
        </p>
      )}

      {isLoading && !view && !error && (
        <p className="text-body-sans text-gray-04">Reading the testnet nodes…</p>
      )}

      {lead && (
        <section className="flex flex-col gap-5 border border-gray-01 bg-white p-5">
          <Liveness height={lead.height} heightChangedAt={heightChangedAt} />

          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat label="Height" value={String(lead.height)} />
            <Stat label="Slot" value={String(lead.slot)} />
            <Stat label="Phase" value={lead.phase} />
            <Stat
              label="Finality gap"
              value={`${finalityGap(lead)} slots`}
            />
          </dl>

          <dl className="flex flex-col gap-4 border-t border-gray-01 pt-4">
            <div className="flex flex-col gap-1">
              <dt className="text-eyebrow text-gray-05">Chain tip</dt>
              <dd className="text-mono-s break-all text-brand-dark-green">
                {lead.tip}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-eyebrow text-gray-05">
                Last irreversible block
              </dt>
              <dd className="text-mono-s break-all text-brand-dark-green">
                {lead.lib}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {view && view.nodes.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-eyebrow text-gray-05">
              Testnet nodes ({view.nodes.length})
            </h2>
            {view.nodes.length > 1 && (
              <span className="text-caption-sans text-gray-05">
                {nodesAgree(view.nodes)
                  ? 'all reporting the same tip'
                  : 'reporting different tips'}
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {view.nodes.map((node) => (
              <NodeCard key={node.label} node={node} />
            ))}
          </div>
        </section>
      )}

      {view && view.headers.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-eyebrow text-gray-05">
            Recent headers ({view.headers.length})
          </h2>
          <ol className="flex flex-col border border-gray-01 bg-white">
            {view.headers.slice(0, 12).map((hash, index) => (
              <li
                key={hash}
                className="text-mono-s flex gap-4 border-t border-gray-01 px-4 py-2 text-gray-06 first:border-t-0"
              >
                <span className="w-6 shrink-0 text-gray-04">{index}</span>
                <span className="break-all">{hash}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="text-caption-sans text-gray-05">
        Read from the Logos Blockchain testnet nodes. They allow browser calls,
        but serve plain HTTP while this page is HTTPS, so a small read-only
        endpoint in this app makes the request. Nothing is written.
      </p>
    </div>
  )
}
