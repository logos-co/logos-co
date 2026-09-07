'use client'

import { useEffect, useRef, useState } from 'react'

import type { Block, ChainTime } from '@/lib/cryptarchia'
import { parseBlock } from '@/lib/cryptarchia'

export type StreamState = {
  /** Blocks that arrived on the stream, newest first. */
  blocks: Block[]
  /** True once the stream is open and has not errored. */
  isLive: boolean
}

/** Keep the live list from growing without bound over a long session. */
const MAX_STREAMED = 24

/**
 * How long a drop is tolerated before the badge stops claiming to be live.
 *
 * `EventSource` reconnects by itself, and the relay closes every few minutes
 * by design, so short gaps are normal. Reporting each one would make the badge
 * flicker for something the viewer does not need to know about.
 */
const DROP_GRACE_MS = 30000

/**
 * Subscribes to the node's live block stream, relayed as server-sent events.
 *
 * `EventSource` reconnects on its own, which matters because the relay closes
 * every few minutes rather than holding a function instance open forever.
 */
export function useChainStream(time: ChainTime | null): StreamState {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [isLive, setLive] = useState(false)

  // The time info arrives with the first poll and is needed to turn a slot
  // into a timestamp, so it is read through a ref rather than resubscribing.
  const timeRef = useRef(time)
  timeRef.current = time

  useEffect(() => {
    const source = new EventSource('/api/chain/stream')

    let dropTimer: ReturnType<typeof setTimeout> | undefined

    source.onopen = () => {
      clearTimeout(dropTimer)
      setLive(true)
    }

    source.onmessage = (event) => {
      try {
        const payload: unknown = JSON.parse(event.data)
        const raw = (payload as Record<string, unknown>)?.block
        const block = parseBlock(raw, timeRef.current)
        if (!block) return

        setBlocks((current) =>
          current.some((b) => b.id === block.id)
            ? current
            : [block, ...current].slice(0, MAX_STREAMED),
        )
      } catch {
        // A malformed line is not worth taking the stream down for.
      }
    }

    source.onerror = () => {
      // Only give up on the claim if it stays down; a reconnect within the
      // grace period should look like nothing happened.
      clearTimeout(dropTimer)
      dropTimer = setTimeout(() => setLive(false), DROP_GRACE_MS)
    }

    return () => {
      clearTimeout(dropTimer)
      source.close()
    }
  }, [])

  return { blocks, isLive }
}
