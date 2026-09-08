'use client'

import { useEffect, useState } from 'react'

import type { NodeLocation } from '@/lib/storage-echo'
import { fetchLocation, fetchReachable } from '@/lib/storage-echo'
import type { StorageNode } from '@/lib/storage-fleet'

export type NodeProbe = {
  location: NodeLocation | null
  isReachable: boolean | null
}

/**
 * Locates each node and checks whether its port answers.
 *
 * One roster is six nodes, so this fans out without batching. Results arrive
 * per node and the row fills in as they land, rather than the list waiting for
 * the slowest.
 */
export function useNodeProbes(nodes: StorageNode[]): Record<string, NodeProbe> {
  const [probes, setProbes] = useState<Record<string, NodeProbe>>({})

  // `nodes` is held in state by useStorageFleet, so its identity only changes
  // when a roster actually arrives. That makes it a safe dependency: switching
  // fleet re-probes, re-rendering does not.
  useEffect(() => {
    let cancelled = false
    setProbes({})

    for (const node of nodes) {
      if (!node.address) continue

      void (async () => {
        const [location, isReachable] = await Promise.all([
          fetchLocation(node.address),
          fetchReachable(node.address, node.port),
        ])
        if (cancelled) return
        setProbes((current) => ({
          ...current,
          [node.host]: { location, isReachable },
        }))
      })()
    }

    return () => {
      cancelled = true
    }
  }, [nodes])

  return probes
}
