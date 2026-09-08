'use client'

import { useCallback, useState } from 'react'

export type ShareState = {
  url: string | null
  isPublishing: boolean
  error: string | null
}

const IDLE: ShareState = { url: null, isPublishing: false, error: null }

/**
 * Publishes bytes under their CID and returns a link anyone can open.
 *
 * `isEnabled` comes from the server, because whether a store is configured is
 * a deployment fact the page should state up front rather than discover by
 * failing after someone clicks.
 */
export function useShareContent(isEnabled = true) {
  const [state, setState] = useState<ShareState>(IDLE)

  const publish = useCallback(
    async (
      bytes: Uint8Array,
      cid: string,
      mimetype: string,
      filename: string
    ) => {
      setState({ url: null, isPublishing: true, error: null })

      const query = new URLSearchParams({ cid, mimetype, filename })

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

  return { ...state, isEnabled, publish, reset }
}
