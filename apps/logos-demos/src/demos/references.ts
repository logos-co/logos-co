/**
 * Everything each demo actually talks to or was built from.
 *
 * One entry per URL, so a visitor can go and check the thing for themselves
 * rather than take the page's word for it. Every link here was opened and its
 * title read: `logos.co` pages carry Next's 404 template inside their payload,
 * so a body search reports every one of them as missing.
 *
 * Checked 2026-09-09. Endpoints move; re-check rather than assume.
 */

export type Reference = {
  label: string
  /** One line on why this demo touches it. */
  note: string
  href: string
}

/** GitHub organisations the whole stack lives in. */
export const ORGS: readonly Reference[] = [
  { label: 'logos-co', note: 'Logos', href: 'https://github.com/logos-co' },
  {
    label: 'logos-messaging',
    note: 'Messaging',
    href: 'https://github.com/logos-messaging',
  },
  {
    label: 'logos-blockchain',
    note: 'Blockchain',
    href: 'https://github.com/logos-blockchain',
  },
  {
    label: 'logos-storage',
    note: 'Storage',
    href: 'https://github.com/logos-storage',
  },
]

const MESSAGING: readonly Reference[] = [
  {
    label: 'logos-delivery-js',
    note: 'The library this page runs. Published as @waku/sdk',
    href: 'https://github.com/logos-messaging/logos-delivery-js',
  },
  {
    label: 'logos-delivery',
    note: 'The protocols themselves, in Nim',
    href: 'https://github.com/logos-messaging/logos-delivery',
  },
  {
    label: 'LIP 12: Filter',
    note: 'How this browser subscribes to one topic',
    href: 'https://lip.logos.co/messaging/core/draft/12/filter.html',
  },
  {
    label: 'LIP 13: Store',
    note: 'How it asks for messages sent before it arrived',
    href: 'https://lip.logos.co/messaging/core/draft/13/store.html',
  },
  {
    label: 'LIP 19: Light push',
    note: 'How it sends without relaying for everyone else',
    href: 'https://lip.logos.co/messaging/core/draft/19/lightpush.html',
  },
  {
    label: 'Logos Messaging',
    note: 'What the stack area is for',
    href: 'https://logos.co/technology-stack/messaging',
  },
]

const BLOCKCHAIN: readonly Reference[] = [
  {
    label: 'logos-blockchain',
    note: 'The node this page reads, and its API',
    href: 'https://github.com/logos-blockchain/logos-blockchain',
  },
  {
    label: 'Testnet node',
    note: 'The node itself. Plain HTTP, which is why a route handler asks it',
    href: 'http://65.109.51.37:18080/cryptarchia/info',
  },
  {
    label: 'LEZ block explorer',
    note: 'The same chain, indexed by someone else',
    href: 'https://explorer.testnet.lez.logos.co',
  },
  {
    label: 'Logos Blockchain',
    note: 'What the stack area is for',
    href: 'https://logos.co/technology-stack/blockchain',
  },
]

const STORAGE: readonly Reference[] = [
  {
    label: 'logos-storage-nim',
    note: 'The node. Its block size, codecs and manifest define the address',
    href: 'https://github.com/logos-storage/logos-storage-nim',
  },
  {
    label: 'nim-merkletree',
    note: 'The tree and the proofs, ported for this page',
    href: 'https://github.com/logos-storage/nim-merkletree',
  },
  {
    label: 'Fleet roster',
    note: 'The node list this page shows',
    href: 'https://fleets.logos.co/logos-test/storage-network.json',
  },
  {
    label: 'echo.codex.storage',
    note: 'Locates each node and checks whether its port answers',
    href: 'https://echo.codex.storage',
  },
  {
    label: "Nim's mimetypes",
    note: 'The table a node checks a file type against',
    href: 'https://github.com/nim-lang/Nim/blob/version-2-2/lib/pure/mimetypes.nim',
  },
  {
    label: 'Logos Storage',
    note: 'What the stack area is for',
    href: 'https://logos.co/technology-stack/storage',
  },
]

const BY_DEMO: Record<string, readonly Reference[]> = {
  '/messaging': MESSAGING,
  '/blockchain': BLOCKCHAIN,
  '/storage': STORAGE,
}

export function referencesFor(href: string): readonly Reference[] {
  return BY_DEMO[href] ?? []
}
