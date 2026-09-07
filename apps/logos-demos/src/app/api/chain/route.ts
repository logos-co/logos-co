import { NextResponse } from 'next/server'

import { parseNodeStatus } from '@/lib/cryptarchia'

/**
 * Reads the Logos Blockchain testnet nodes.
 *
 * The nodes answer with `access-control-allow-origin: *`, so a browser would
 * be welcome to call them. It cannot: they are served over plain HTTP and this
 * app is HTTPS, and browsers block that as mixed content before the request
 * leaves the page. That, not CORS, is why this route exists.
 *
 * It is read-only. `/mempool/add/tx` answers 405 to a GET and is the only
 * write surface the nodes expose; nothing here goes near it.
 */

/** From `deployment/.env.testnet` in logos-blockchain: PUBLIC_IP_ADDR + node API ports. */
const NODE_HOST = 'http://65.109.51.37'
const NODE_PORTS = [18080, 18081, 18082, 18083] as const

/** Someone else's testnet, so answers are shared rather than fetched per visitor. */
const CACHE_SECONDS = 10
const NODE_TIMEOUT_MS = 8000

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(NODE_TIMEOUT_MS),
    next: { revalidate: CACHE_SECONDS },
  })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.json()
}

/** One node's chain and network state. Returns null when it does not answer. */
async function readNode(port: number) {
  try {
    const [info, network] = await Promise.all([
      getJson(`${NODE_HOST}:${port}/cryptarchia/info`),
      getJson(`${NODE_HOST}:${port}/network/info`),
    ])
    return parseNodeStatus({ info, network }, `:${port}`)
  } catch {
    // One node being unreachable is normal on a testnet and must not take the
    // whole view down with it.
    return null
  }
}

export async function GET() {
  const settled = await Promise.all(NODE_PORTS.map(readNode))
  const nodes = settled.filter((node) => node !== null)

  if (nodes.length === 0) {
    return NextResponse.json(
      { error: 'No testnet node answered.' },
      { status: 502 },
    )
  }

  // The header chain is the same on every node that agrees, so one is enough.
  let headers: string[] = []
  try {
    const raw = await getJson(`${NODE_HOST}:${NODE_PORTS[0]}/cryptarchia/headers`)
    if (Array.isArray(raw)) {
      headers = raw.filter((h): h is string => typeof h === 'string')
    }
  } catch {
    // The status view is still worth showing without the header list.
  }

  return NextResponse.json(
    { nodes, headers, fetchedAt: Date.now() },
    {
      headers: {
        'Cache-Control': `public, max-age=0, s-maxage=${CACHE_SECONDS}`,
      },
    },
  )
}
