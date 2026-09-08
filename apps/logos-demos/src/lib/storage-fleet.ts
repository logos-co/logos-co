// The Logos Storage network roster, published at fleets.logos.co.
//
// The roster is public but sends no CORS header, so the page cannot read it
// directly. `/api/storage/fleet` fetches it server-side and passes it through
// unchanged; `parseFleet` below is the only parser, and it runs on the client.
//
// It is the roster, not the network itself. A browser cannot join Logos
// Storage: discovery is discv5 over UDP and transfer is libp2p TCP, and it has
// neither. See docs/storage-research.md.

/** The published fleets. `logos.test` is the populated one. */
export const FLEETS = ['logos-test', 'logos-dev'] as const
export type FleetName = (typeof FLEETS)[number]

/** The upstream roster. Only the route handler reads this. */
export const FLEET_URL = (fleet: FleetName) =>
  `https://fleets.logos.co/${fleet}/storage-network.json`

/** What the page fetches. */
export const FLEET_API = (fleet: FleetName) => `/api/storage/fleet?fleet=${fleet}`

export type StorageNode = {
  /** Full host, e.g. `node-01.do-ams3.logos.test`. */
  host: string
  /** Short name, e.g. `node-01`. */
  name: string
  /** Provider and region, e.g. `do-ams3`. */
  region: string
  /**
   * Role code as published. Seen values are `mp` and `rs`.
   *
   * No source in any Logos repository defines them, so it is shown verbatim
   * rather than expanded into a guess.
   */
  role: string
  peerId: string
  address: string
  port: number
  /** Present on nodes that take part in the mix network. */
  mixPubKey: string
  libp2pPubKey: string
  /** Signed peer record, how another node bootstraps to this one. */
  spr: string
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

/**
 * Validate one entry. The roster is served by infrastructure we do not control,
 * so an entry that does not match the shape is dropped rather than rendered.
 */
export function parseNode(raw: unknown): StorageNode | null {
  if (typeof raw !== 'object' || raw === null) return null

  const node = raw as Record<string, unknown>
  const host = text(node.host)
  if (!host) return null

  // Hosts are `<name>.<region>.<fleet>`, so the first two segments name the
  // node and where it runs.
  const [name = host, region = ''] = host.split('.')

  return {
    host,
    name,
    region,
    role: text(node.role) || 'unknown',
    peerId: text(node.peerId),
    address: text(node.address),
    port: typeof node.port === 'number' ? node.port : 0,
    mixPubKey: text(node.mixPubKey),
    libp2pPubKey: text(node.libp2pPubKey),
    spr: text(node.spr),
  }
}

export function parseFleet(raw: unknown): StorageNode[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(parseNode)
    .filter((node): node is StorageNode => node !== null)
    .sort((a, b) => a.host.localeCompare(b.host))
}

/** Nodes grouped by region, so the geographic spread is visible at a glance. */
export function groupByRegion(
  nodes: StorageNode[],
): { region: string; nodes: StorageNode[] }[] {
  const groups = new Map<string, StorageNode[]>()
  for (const node of nodes) {
    groups.set(node.region, [...(groups.get(node.region) ?? []), node])
  }
  return [...groups.entries()]
    .map(([region, group]) => ({ region, nodes: group }))
    .sort((a, b) => a.region.localeCompare(b.region))
}

export function countByRole(nodes: StorageNode[]): Record<string, number> {
  return nodes.reduce<Record<string, number>>((counts, node) => {
    return { ...counts, [node.role]: (counts[node.role] ?? 0) + 1 }
  }, {})
}

export function shortenKey(key: string): string {
  return key.length <= 18 ? key : `${key.slice(0, 8)}…${key.slice(-8)}`
}
