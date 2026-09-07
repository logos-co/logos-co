/**
 * Where the Logos Blockchain testnet nodes live, and how to talk to them.
 *
 * Import from route handlers only. The nodes are plain HTTP; a browser on this
 * HTTPS page cannot reach them, which is why every call goes through a route.
 *
 * Addresses come from `deployment/.env.testnet` in `logos-blockchain`:
 * `PUBLIC_IP_ADDR` with the four node API ports.
 */

export const NODE_HOST = 'http://65.109.51.37'
export const NODE_PORTS = [18080, 18081, 18082, 18083] as const

/** The node every single-answer query goes to. */
export const LEAD_NODE = `${NODE_HOST}:${NODE_PORTS[0]}`

/** Someone else's testnet, so answers are shared rather than fetched per visitor. */
export const CACHE_SECONDS = 10

export const NODE_TIMEOUT_MS = 8000

export async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(NODE_TIMEOUT_MS),
    next: { revalidate: CACHE_SECONDS },
  })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.json()
}

/** Anything optional: a testnet endpoint going quiet must not fail the page. */
export async function tryJson(url: string): Promise<unknown> {
  try {
    return await getJson(url)
  } catch {
    return null
  }
}

/** Fetch without caching, for lookups where a stale answer would mislead. */
export async function getFresh(url: string): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(NODE_TIMEOUT_MS),
    cache: 'no-store',
  })
}
