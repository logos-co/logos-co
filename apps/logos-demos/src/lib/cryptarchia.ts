// Shapes and helpers for the Logos Blockchain node API (Cryptarchia).
//
// This is the consensus layer, read straight off testnet nodes: the chain tip,
// how far finality trails it, and who each node is talking to. It is not a
// block explorer, and deliberately so. The explorer shows LEZ, the execution
// zone; these numbers are the base chain underneath it and use their own
// height and slot counters.

/**
 * How long the height may sit still before the chain is called stalled.
 *
 * Measured cadence on this testnet is a block every 30 to 90 seconds, so a
 * gap of a minute or two is ordinary. Anything poll-count based flaps between
 * normal blocks; this is deliberately several times the longest gap seen.
 */
const STALL_AFTER_MS = 5 * 60 * 1000

export type NodeStatus = {
  /** Which node answered, by its API port. */
  label: string
  /** libp2p peer id of the node itself. */
  peerId: string
  /** Head of the chain this node has seen. */
  tip: string
  /** Last irreversible block: everything up to here is final. */
  lib: string
  height: number
  slot: number
  libSlot: number
  /** The node's own report, e.g. "Online". */
  state: string
  /** Where it is in consensus, e.g. "Following". */
  phase: string
  connectedPeers: string[]
}

/**
 * A block as the node returns it.
 *
 * `proofOfLeadership` is the part worth showing: Cryptarchia picks proposers
 * through a private lottery, so the block carries a proof that its author won
 * without naming who they are.
 */
export type Block = {
  id: string
  parent: string
  slot: number
  /** Wall-clock time derived from the slot, or null before time info is known. */
  timestamp: number | null
  transactionCount: number
  leaderKey: string
  voucherCommitment: string
  entropyContribution: string
}

/** Genesis and slot length, used to turn a slot number into a timestamp. */
export type ChainTime = {
  slotDurationMs: number
  genesisTimeUnixMs: number
  currentEpoch: number
}

export type ChainView = {
  nodes: NodeStatus[]
  blocks: Block[]
  /** How many recent header hashes the node offered, whether or not all were fetched. */
  headerCount: number
  /** Transactions waiting to be included. */
  mempoolSize: number
  time: ChainTime | null
  fetchedAt: number
}

export function parseChainTime(raw: unknown): ChainTime | null {
  if (typeof raw !== 'object' || raw === null) return null
  const {
    slot_duration_ms: duration,
    genesis_time_unix_ms: genesis,
    current_epoch: epoch,
  } = raw as Record<string, unknown>

  if (typeof duration !== 'number' || typeof genesis !== 'number') return null
  return {
    slotDurationMs: duration,
    genesisTimeUnixMs: genesis,
    currentEpoch: typeof epoch === 'number' ? epoch : 0,
  }
}

/**
 * Validate chain time as the route returns it, already normalised.
 *
 * Running `parseChainTime` over this instead returns null and the epoch
 * silently renders as a dash. See the note in AGENTS.md; this is the third
 * time the two shapes have been confused.
 */
export function parseChainTimeSummary(raw: unknown): ChainTime | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { slotDurationMs, genesisTimeUnixMs, currentEpoch } = raw as Record<
    string,
    unknown
  >
  if (typeof slotDurationMs !== 'number' || typeof genesisTimeUnixMs !== 'number') {
    return null
  }
  return {
    slotDurationMs,
    genesisTimeUnixMs,
    currentEpoch: typeof currentEpoch === 'number' ? currentEpoch : 0,
  }
}

export function slotToTimestamp(slot: number, time: ChainTime | null): number | null {
  if (!time) return null
  return time.genesisTimeUnixMs + slot * time.slotDurationMs
}

/** Validate one block as the node returns it. */
export function parseBlock(raw: unknown, time: ChainTime | null): Block | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { header, transactions } = raw as Record<string, unknown>
  if (typeof header !== 'object' || header === null) return null

  const {
    id,
    parent_block: parent,
    slot,
    proof_of_leadership: proof,
  } = header as Record<string, unknown>

  if (typeof id !== 'string' || typeof slot !== 'number') return null

  const lottery = (proof as Record<string, unknown> | undefined) ?? {}
  const text = (value: unknown) => (typeof value === 'string' ? value : '')

  return {
    id,
    parent: typeof parent === 'string' ? parent : '',
    slot,
    timestamp: slotToTimestamp(slot, time),
    transactionCount: Array.isArray(transactions) ? transactions.length : 0,
    leaderKey: text(lottery.leader_key),
    voucherCommitment: text(lottery.voucher_cm),
    entropyContribution: text(lottery.entropy_contribution),
  }
}

/** Validate a block that has already been through `parseBlock`, as the route returns it. */
export function parseBlockSummary(raw: unknown): Block | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Record<string, unknown>
  if (typeof b.id !== 'string' || typeof b.slot !== 'number') return null

  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  return {
    id: b.id,
    parent: text(b.parent),
    slot: b.slot,
    timestamp: typeof b.timestamp === 'number' ? b.timestamp : null,
    transactionCount:
      typeof b.transactionCount === 'number' ? b.transactionCount : 0,
    leaderKey: text(b.leaderKey),
    voucherCommitment: text(b.voucherCommitment),
    entropyContribution: text(b.entropyContribution),
  }
}

export type Liveness =
  | { state: 'unknown' }
  | { state: 'advancing'; height: number; sinceMs: number }
  | { state: 'stalled'; height: number; sinceMs: number }

/**
 * Validate one node's answer. The nodes are someone else's testnet and can
 * return anything, so a shape that does not match is dropped rather than
 * rendered.
 */
export function parseNodeStatus(raw: unknown, label: string): NodeStatus | null {
  if (typeof raw !== 'object' || raw === null) return null

  const { info, network } = raw as Record<string, unknown>
  const chain = (info as Record<string, unknown> | undefined)?.cryptarchia_info
  if (typeof chain !== 'object' || chain === null) return null

  const {
    tip,
    lib,
    height,
    slot,
    lib_slot: libSlot,
    state,
  } = chain as Record<string, unknown>

  if (typeof height !== 'number' || typeof slot !== 'number') return null

  const net = (network as Record<string, unknown> | undefined) ?? {}
  const peers = net.connected_peers

  return {
    label,
    peerId: typeof net.peer_id === 'string' ? net.peer_id : '',
    tip: typeof tip === 'string' ? tip : '',
    lib: typeof lib === 'string' ? lib : '',
    height,
    slot,
    libSlot: typeof libSlot === 'number' ? libSlot : 0,
    state: typeof state === 'string' ? state : 'Unknown',
    phase:
      typeof (info as Record<string, unknown>)?.phase === 'string'
        ? ((info as Record<string, unknown>).phase as string)
        : 'Unknown',
    connectedPeers: Array.isArray(peers)
      ? peers.filter((p): p is string => typeof p === 'string')
      : [],
  }
}

/** Validate the payload this app's own route returns, which is already normalised. */
export function parseChainView(raw: unknown): ChainView | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { nodes, blocks, headerCount, mempoolSize, time, fetchedAt } =
    raw as Record<string, unknown>
  if (!Array.isArray(nodes)) return null

  return {
    nodes: nodes.filter(
      (n): n is NodeStatus =>
        typeof n === 'object' && n !== null && 'height' in n && 'tip' in n,
    ),
    blocks: Array.isArray(blocks)
      ? blocks
          .map(parseBlockSummary)
          .filter((b): b is Block => b !== null)
      : [],
    headerCount: typeof headerCount === 'number' ? headerCount : 0,
    mempoolSize: typeof mempoolSize === 'number' ? mempoolSize : 0,
    time: parseChainTimeSummary(time),
    fetchedAt: typeof fetchedAt === 'number' ? fetchedAt : Date.now(),
  }
}

/**
 * Whether the chain is producing.
 *
 * Time since the height last changed is the signal. The nodes report
 * `state: "Online"` whether or not blocks are being made, so that field says
 * the process is up and nothing more.
 */
export function readLiveness(
  height: number | null,
  sinceMs: number | null,
): Liveness {
  if (height === null || sinceMs === null) return { state: 'unknown' }
  return sinceMs >= STALL_AFTER_MS
    ? { state: 'stalled', height, sinceMs }
    : { state: 'advancing', height, sinceMs }
}

/** "just now", "40s ago", "6 min ago". */
export function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

export function formatAge(ms: number): string {
  if (ms < 5000) return 'just now'
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`
  const minutes = Math.floor(ms / 60000)
  return `${minutes} min ago`
}

/** How far behind the tip finality is, in slots. */
export function finalityGap(node: NodeStatus): number {
  return Math.max(0, node.slot - node.libSlot)
}

/** True when every node that answered reports the same tip. */
export function nodesAgree(nodes: NodeStatus[]): boolean {
  if (nodes.length < 2) return false
  return nodes.every((n) => n.tip === nodes[0].tip)
}

export function shortenHash(hash: string): string {
  return hash.length <= 18 ? hash : `${hash.slice(0, 8)}…${hash.slice(-8)}`
}

export { STALL_AFTER_MS }
