/**
 * Computes the CID that Logos Storage gives a file.
 *
 * A browser cannot join the network, but the identifier is not a secret the
 * network hands out: it is a pure function of the bytes, so the same file gets
 * the same CID everywhere, forever. That is what content addressing means, and
 * it is the one part of storage a page can do honestly and in full.
 *
 * Everything here was read out of logos-storage-nim and then checked against a
 * real node running locally (v0.4.5). The fixtures in `storage-cid.test.ts`
 * are its answers, not this file's. See docs/storage-cid.md.
 */

/** Block size the node chunks with. `DefaultBlockSize` in storagetypes.nim. */
export const BLOCK_SIZE = 65536

/** Multicodecs the node registers for its own content. multicodec_exts.nim. */
const CODEC_MANIFEST = 0xcd01
const CODEC_BLOCK = 0xcd02
const CODEC_ROOT = 0xcd03

/** sha2-256, the only hash the node uses for CIDs. */
const CODEC_SHA256 = 0x12

/**
 * `CidVersion` in nim-libp2p starts at `CIDvIncorrect`, so CIDv1 encodes as 2.
 * Writing 1 here produces a plausible, wrong CID and nothing complains.
 */
const CID_VERSION_V1 = 2

/**
 * Key byte mixed into each merkle compression, so a node cannot be confused
 * for a leaf, or a padded position for a real one. `ByteTreeKey`.
 */
export const KEY_NONE = 0
export const KEY_BOTTOM = 1
export const KEY_ODD = 2
export const KEY_ODD_AND_BOTTOM = 3

export const ZERO = new Uint8Array(32)

export type CidBreakdown = {
  /** The manifest CID. This is what the node prints on upload. */
  cid: string
  /** Root of the merkle tree over the padded blocks. */
  treeCid: string
  blockCount: number
  datasetSize: number
  /** One per block, in order, as `zDv…` block CIDs. */
  blockCids: string[]
  /**
   * The merkle tree, bottom-up, `levels[0]` being the leaves.
   *
   * Kept as raw digests rather than hex so proofs can be taken from it. The
   * page formats them for display.
   */
  levels: Uint8Array[][]
}

export const sha256 = async (data: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource))

function varint(value: number): Uint8Array {
  const out: number[] = []
  let rest = value
  do {
    const byte = rest & 0x7f
    rest >>>= 7
    out.push(rest > 0 ? byte | 0x80 : byte)
  } while (rest > 0)
  return new Uint8Array(out)
}

const concat = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  parts.reduce((offset, part) => {
    out.set(part, offset)
    return offset + part.length
  }, 0)
  return out
}

/** A CIDv1: version, content codec, then the multihash. */
const cidBytes = (codec: number, digest: Uint8Array): Uint8Array =>
  concat([
    new Uint8Array([0x01]),
    varint(codec),
    varint(CODEC_SHA256),
    varint(digest.length),
    digest,
  ])

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** base58btc, then the `z` multibase prefix the node prints. */
export function toBase58Cid(bytes: Uint8Array): string {
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8
      digits[i] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }

  let leading = ''
  for (const byte of bytes) {
    if (byte !== 0) break
    leading += '1'
  }

  return `z${leading}${digits
    .reverse()
    .map((d) => BASE58[d])
    .join('')}`
}

/** Digests are shown as hex, and only ever for display. */
export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

/** `compress` in merkletree.nim: sha256 over both children and the key byte. */
export async function compress(
  left: Uint8Array,
  right: Uint8Array,
  key: number
): Promise<Uint8Array> {
  return sha256(concat([left, right, new Uint8Array([key])]))
}

/**
 * Blocks are padded to the full block size before hashing, so a 1-byte file
 * still hashes 64 KiB. Skipping the padding gives a wrong CID silently.
 */
export function blockAt(data: Uint8Array, index: number): Uint8Array {
  const block = new Uint8Array(BLOCK_SIZE)
  block.set(data.subarray(index * BLOCK_SIZE, (index + 1) * BLOCK_SIZE))
  return block
}

/**
 * Folds the leaves to a root, carrying the key byte rules: the bottom layer is
 * marked, and a layer with an odd count pairs its last node with zeroes.
 */
export async function foldTree(leaves: Uint8Array[]): Promise<Uint8Array[][]> {
  const levels: Uint8Array[][] = [leaves]
  let layer = leaves
  let isBottom = true

  // An empty upload is rejected by the node, so there is always one leaf, and
  // even that single leaf gets compressed rather than becoming the root.
  for (;;) {
    const next: Uint8Array[] = []
    for (let i = 0; i + 1 < layer.length; i += 2) {
      next.push(
        await compress(layer[i], layer[i + 1], isBottom ? KEY_BOTTOM : KEY_NONE)
      )
    }
    if (layer.length % 2 === 1) {
      const last = layer[layer.length - 1]
      next.push(
        await compress(last, ZERO, isBottom ? KEY_ODD_AND_BOTTOM : KEY_ODD)
      )
    }

    levels.push(next)
    layer = next
    isBottom = false
    if (layer.length === 1) return levels
  }
}

/**
 * The Manifest protobuf, wrapped in the one-field envelope the node writes.
 *
 * Field order and numbering come from manifest.nim. `filename` is omitted when
 * absent rather than sent empty, which changes the bytes and so the CID.
 */
function encodeManifest(
  treeCid: Uint8Array,
  datasetSize: number,
  filename: string | null,
  mimetype: string | null
): Uint8Array {
  const varintField = (field: number, value: number) =>
    concat([varint(field << 3), varint(value)])
  const bytesField = (field: number, value: Uint8Array) =>
    concat([varint((field << 3) | 2), varint(value.length), value])
  const stringField = (field: number, value: string) =>
    bytesField(field, new TextEncoder().encode(value))

  const fields = [
    varintField(1, 0), // manifestVersion
    bytesField(2, treeCid),
    varintField(3, BLOCK_SIZE),
    varintField(4, datasetSize),
    varintField(5, CODEC_BLOCK), // codec
    varintField(6, CODEC_SHA256), // hcodec
    varintField(7, CID_VERSION_V1),
    ...(filename ? [stringField(8, filename)] : []),
    ...(mimetype ? [stringField(9, mimetype)] : []),
  ]

  return bytesField(1, concat(fields))
}

export type CidOptions = {
  /** Set only when the upload carries a `Content-Disposition` filename. */
  filename?: string | null
  /** The node defaults this to `application/octet-stream`. */
  mimetype?: string | null
}

/**
 * Computes the CID and everything needed to show the work.
 *
 * Pure: it reads the bytes and returns, and never touches the network.
 */
export async function computeCid(
  data: Uint8Array,
  options: CidOptions = {}
): Promise<CidBreakdown> {
  const { filename = null, mimetype = 'application/octet-stream' } = options

  if (data.length === 0) {
    throw new Error('Logos Storage rejects an empty upload, so it has no CID.')
  }

  const blockCount = Math.ceil(data.length / BLOCK_SIZE)
  const blocks = Array.from({ length: blockCount }, (_, i) => blockAt(data, i))
  const leaves = await Promise.all(blocks.map(sha256))
  const levels = await foldTree(leaves)

  const treeCidBytes = cidBytes(CODEC_ROOT, levels[levels.length - 1][0])
  const manifest = encodeManifest(treeCidBytes, data.length, filename, mimetype)

  return {
    cid: toBase58Cid(cidBytes(CODEC_MANIFEST, await sha256(manifest))),
    treeCid: toBase58Cid(treeCidBytes),
    blockCount,
    datasetSize: data.length,
    blockCids: leaves.map((leaf) => toBase58Cid(cidBytes(CODEC_BLOCK, leaf))),
    levels,
  }
}
