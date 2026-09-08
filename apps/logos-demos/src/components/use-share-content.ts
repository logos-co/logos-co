'use client'

import { useCallback, useEffect, useState } from 'react'

/** Unknown until the server answers, so the page never guesses out loud. */
export type ShareAvailability = 'unknown' | 'enabled' | 'disabled'

export type ShareState = {
  url: string | null
  isPublishing: boolean
  error: string | null
}

const IDLE: ShareState = { url: null, isPublishing: false, error: null }

/**
 * Publishes bytes under their CID and returns a link anyone can open.
 *
 * Whether publishing is possible is asked of the server at runtime rather than
 * read from the environment while rendering. The page is statically
 * prerendered, so a build-time read would be frozen into the HTML — which is
 * exactly what went wrong: the token existed, the deployed page still said
 * sharing was off, and only a rebuild would have changed it.
 */
export function useShareContent() {
  const [availability, setAvailability] = useState<ShareAvailability>('unknown')
  const [state, setState] = useState<ShareState>(IDLE)

  useEffect(() => {
    let cancelled = false

    const ask = async () => {
      try {
        const response = await fetch('/api/storage/content')
        const payload = response.ok ? await response.json() : null
        if (cancelled) return
        setAvailability(payload?.enabled ? 'enabled' : 'disabled')
      } catch {
        // Treated as off rather than left unknown: a button that cannot work
        // is worse than saying plainly that this deployment cannot publish.
        if (!cancelled) setAvailability('disabled')
      }
    }

    void ask()
    return () => {
      cancelled = true
    }
  }, [])

  const publish = useCallback(
    async (
      bytes: Uint8Array,
      cid: string,
      mimetype: string | null,
      filename: string
    ) => {
      setState({ url: null, isPublishing: true, error: null })

      // No mimetype is a real state, not a missing parameter: the node stores
      // nothing in that field, and the CID reflects that. It has to survive to
      // the server or the recomputed CID will not match.
      const query = new URLSearchParams({ cid, filename })
      if (mimetype) query.set('mimetype', mimetype)

      try {
        const response = await fetch(`/api/storage/content?${query}`, {
          method: 'POST',
          body: bytes as BodyInit,
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          setState({
            url: null,
            isPublishing: false,
            error: payload?.error ?? `Publishing failed (${response.status}).`,
          })
          return
        }

        setState({
          url: `${window.location.origin}/storage/c/${payload.cid}`,
          isPublishing: false,
          error: null,
        })
      } catch {
        setState({
          url: null,
          isPublishing: false,
          error: 'Could not reach the app while publishing.',
        })
      }
    },
    []
  )

  const reset = useCallback(() => setState(IDLE), [])

  return { ...state, availability, publish, reset }
}
