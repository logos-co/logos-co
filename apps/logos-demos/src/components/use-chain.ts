'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChainView } from '@/lib/cryptarchia'
import { parseChainView } from '@/lib/cryptarchia'

/** Slots are seconds-scale, so polling faster than this only adds noise. */
const POLL_INTERVAL_MS = 15000

export type ChainState = {
  view: ChainView | null
  /** When the height last changed, as a timestamp, or null before two readings. */
  heightChangedAt: number | null
  isLoading: boolean
  error: string | null
}

const INITIAL: ChainState = {
  view: null,
  heightChangedAt: null,
  isLoading: true,
  error: null,
}

/**
 * Polls this app's route for testnet node state.
 *
 * Watching when the height last changed is what tells a stalled chain from a
 * live one. The nodes themselves always say `state: "Online"`, which only
 * means the process is running.
 */
export function useChain() {
  const [state, setState] = useState<ChainState>(INITIAL)
  const isMountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/chain')
      const payload: unknown = await response.json()
      if (!isMountedRef.current) return

      if (!response.ok) {
        setState((current) => ({
          ...current,
          isLoading: false,
          error: 'Could not reach the testnet nodes.',
        }))
        return
      }

      const view = parseChainView(payload)
      if (!view) {
        setState((current) => ({
          ...current,
          isLoading: false,
          error: 'The nodes answered with something unexpected.',
        }))
        return
      }

      setState((current) => {
        const previousHeight = current.view?.nodes[0]?.height ?? null
        const height = view.nodes[0]?.height ?? null

        // The first reading gives no baseline, so the clock starts there and
        // the badge stays quiet until a second one arrives.
        const heightChangedAt =
          previousHeight === null || height !== previousHeight
            ? Date.now()
            : current.heightChangedAt

        return { view, heightChangedAt, isLoading: false, error: null }
      })
    } catch {
      if (!isMountedRef.current) return
      setState((current) => ({
        ...current,
        isLoading: false,
        error: 'Could not reach the testnet nodes.',
      }))
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    void load()
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS)

    return () => {
      isMountedRef.current = false
      clearInterval(timer)
    }
  }, [load])

  return state
}
