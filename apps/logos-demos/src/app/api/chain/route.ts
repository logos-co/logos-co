import { NextResponse } from 'next/server'

import {
  CACHE_SECONDS,
  getJson,
  LEAD_NODE,
  NODE_PORTS,
  NODE_HOST,
  tryJson,
} from '@/lib/chain-nodes'
import { parseBlock, parseChainTime, parseNodeStatus } from '@/lib/cryptarchia'

/**
 * Reads the Logos Blockchain testnet nodes.
 *
 * The nodes answer with `access-control-allow-origin: *`, so a browser would
 * be welcome to call them. It cannot: they are served over plain HTTP and this
 * app is HTTPS, and browsers block that as mixed content before the request
 * leaves the page. That, not CORS, is why this route exists.
 *
 * It is read-only. The nodes expose write surfaces (`/mempool/add/tx`, the
 * wallet and SDP routes); nothing here goes near them.
 */

/** How many recent blocks to resolve. Each one is a request, so this is kept small. */
const BLOCK_LIMIT = 12

async function readNode(port: number) {
  try {
    const [info, network] = await Promise.all([
      getJson(`${NODE_HOST}:${port}/cryptarchia/info`),
      getJson(`${NODE_HOST}:${port}/network/info`),
    ])
    return parseNodeStatus({ info, network }, `:${port}`)
  } catch {
    // One node being unreachable is normal on a testnet.
    return null
  }
}

export async function GET() {
  const lead = LEAD_NODE

  const [statuses, rawHeaders, rawTime, rawMempool] = await Promise.all([
    Promise.all(NODE_PORTS.map(readNode)),
    tryJson(`${lead}/cryptarchia/headers`),
    tryJson(`${lead}/time/info`),
    tryJson(`${lead}/mempool/view`),
  ])

  const nodes = statuses.filter((node) => node !== null)
  if (nodes.length === 0) {
    return NextResponse.json(
      { error: 'No testnet node answered.' },
      { status: 502 },
    )
  }

  const time = parseChainTime(rawTime)

  // Headers arrive newest first and each block's parent is the next one, so
  // this walks the chain. Only the visible slice is resolved: the node has no
  // working slot-range query, so every block is its own request.
  const headers = Array.isArray(rawHeaders)
    ? rawHeaders.filter((h): h is string => typeof h === 'string')
    : []

  const blocks = (
    await Promise.all(
      headers.slice(0, BLOCK_LIMIT).map(async (id) => {
        const raw = await tryJson(`${lead}/cryptarchia/blocks/${id}`)
        return raw ? parseBlock(raw, time) : null
      }),
    )
  ).filter((block) => block !== null)

  return NextResponse.json(
    {
      nodes,
      blocks,
      headerCount: headers.length,
      mempoolSize: Array.isArray(rawMempool) ? rawMempool.length : 0,
      time,
      fetchedAt: Date.now(),
    },
    {
      headers: {
        'Cache-Control': `public, max-age=0, s-maxage=${CACHE_SECONDS}`,
      },
    },
  )
}
