'use client'

import { useState } from 'react'

import { useStorageFleet } from '@/components/use-storage-fleet'
import type { FleetName, StorageNode } from '@/lib/storage-fleet'
import {
  countByRole,
  FLEETS,
  groupByRegion,
  shortenKey,
} from '@/lib/storage-fleet'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-eyebrow text-gray-05">{label}</dt>
      <dd className="text-mono-s break-all text-gray-06">{value || '—'}</dd>
    </div>
  )
}

function NodeCard({ node }: { node: StorageNode }) {
  return (
    <article className="flex flex-col gap-3 border border-gray-01 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-h4-sans text-brand-dark-green">{node.name}</span>
        <span className="text-caption-sans text-gray-05">
          role {node.role}
        </span>
      </div>
      <dl className="flex flex-col gap-2">
        <Field label="Peer id" value={shortenKey(node.peerId)} />
        <Field label="Address" value={`${node.address}:${node.port}`} />
        <Field
          label="Mix relay"
          value={node.mixPubKey ? 'yes' : 'no mix key published'}
        />
      </dl>
    </article>
  )
}

export function StorageNetwork() {
  const [fleet, setFleet] = useState<FleetName>('logos-test')
  const { nodes, isLoading, error } = useStorageFleet(fleet)

  const regions = groupByRegion(nodes)
  const roles = countByRole(nodes)
  const mixCapable = nodes.filter((node) => node.mixPubKey).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {FLEETS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setFleet(name)}
            className={`text-body-sans cursor-pointer border px-3 py-1.5 ${
              name === fleet
                ? 'border-brand-dark-green bg-brand-dark-green text-brand-off-white'
                : 'border-gray-01 bg-white text-gray-06 hover:border-gray-02'
            }`}
          >
            {name.replace('-', '.')}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-caption-sans text-accent-purple">
          {error}
        </p>
      )}

      {isLoading && nodes.length === 0 && !error && (
        <p className="text-body-sans text-gray-04">Reading the roster…</p>
      )}

      {nodes.length > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-5 border border-gray-01 bg-white p-5 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <dt className="text-eyebrow text-gray-05">Nodes</dt>
              <dd className="text-h4-sans text-brand-dark-green">
                {nodes.length}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-eyebrow text-gray-05">Regions</dt>
              <dd className="text-h4-sans text-brand-dark-green">
                {regions.length}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-eyebrow text-gray-05">Mix relays</dt>
              <dd className="text-h4-sans text-brand-dark-green">
                {mixCapable}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-eyebrow text-gray-05">Roles</dt>
              <dd className="text-h4-sans text-brand-dark-green">
                {Object.entries(roles)
                  .map(([role, count]) => `${count} ${role}`)
                  .join(', ')}
              </dd>
            </div>
          </dl>

          {regions.map(({ region, nodes: group }) => (
            <section key={region} className="flex flex-col gap-3">
              <h2 className="text-eyebrow text-gray-05">
                {region} ({group.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.map((node) => (
                  <NodeCard key={node.host} node={node} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <p className="text-caption-sans text-gray-05">
        Read from the roster published at fleets.logos.co. This shows who runs
        the network, not its contents: a browser cannot join Logos Storage, so
        there is nothing here to upload a file to.
      </p>
    </div>
  )
}
