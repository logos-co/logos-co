// The demo catalogue: one entry per demo, and the single source of truth for
// the sidebar, the overview list, and each demo's own heading. Adding a demo
// means adding an entry here and a route at its `href`.

export type Demo = {
  /** Route for the demo. */
  href: string
  /** Sidebar label — short, the name of the thing being demonstrated. */
  label: string
  /** Which part of the Logos stack this exercises. */
  stack: string
  /** One line, shown on the overview and as the demo's own standfirst. */
  summary: string
}

export const DEMOS: readonly Demo[] = [
  {
    href: '/messaging',
    label: 'Logos Messaging',
    stack: 'Delivery',
    summary:
      'Your browser joins the peer-to-peer messaging network directly and exchanges messages with other browsers. No backend, no account, no install.',
  },
  {
    href: '/blockchain',
    label: 'Logos Blockchain',
    stack: 'Cryptarchia',
    summary:
      'Live blocks and consensus state read from the Logos Blockchain testnet nodes, including the proof of leadership behind each block.',
  },
  {
    href: '/storage',
    label: 'Logos Storage',
    stack: 'Network',
    summary:
      'The live roster of nodes running the Logos Storage network, read straight from the published fleet list.',
  },
]

export function findDemo(href: string): Demo | undefined {
  return DEMOS.find((demo) => demo.href === href)
}
