/**
 * The roster is published by infrastructure we do not control, so `parseNode`
 * is a boundary. These tests are about what it refuses.
 *
 * The shape below matches a real `fleets.logos.co` entry, checked 2026-09-08.
 */
import { describe, expect, it } from 'vitest'

import { groupByRegion, parseFleet, parseNode } from './storage-fleet'

const entry = (overrides: Record<string, unknown> = {}) => ({
  host: 'node-01.do-ams3.logos.test',
  role: 'mp',
  peerId: '16Uiu2HAmExample',
  address: '178.128.140.206',
  port: 8070,
  mixPubKey: 'abc',
  libp2pPubKey: 'def',
  spr: 'spr:xyz',
  ...overrides,
})

describe('parseNode', () => {
  it('reads a well-formed entry and splits the host', () => {
    const node = parseNode(entry())
    expect(node).toMatchObject({
      name: 'node-01',
      region: 'do-ams3',
      peerId: '16Uiu2HAmExample',
      port: 8070,
    })
  })

  it.each(['host', 'peerId', 'address'])(
    'drops an entry missing %s, rather than rendering a blank card',
    (field) => {
      expect(parseNode(entry({ [field]: '' }))).toBeNull()
      expect(parseNode(entry({ [field]: undefined }))).toBeNull()
    },
  )

  it.each([
    ['missing', undefined],
    ['zero', 0],
    ['negative', -1],
    ['out of range', 70000],
    ['fractional', 80.5],
    ['not a number', 'http'],
  ])('drops an entry whose port is %s', (_label, port) => {
    expect(parseNode(entry({ port }))).toBeNull()
  })

  it('accepts a numeric string port', () => {
    // The roster publishes numbers. Tolerating a string means a change of
    // encoding upstream degrades to nothing instead of emptying the list.
    expect(parseNode(entry({ port: '8070' }))?.port).toBe(8070)
  })

  it('keeps a node whose descriptive fields are missing', () => {
    // A node with no mix key is a real state the UI reports, not a broken row.
    const node = parseNode(entry({ role: '', mixPubKey: '', spr: '' }))
    expect(node?.role).toBe('unknown')
    expect(node?.mixPubKey).toBe('')
  })

  it('names the region when the host has no dots', () => {
    const node = parseNode(entry({ host: 'localhost' }))
    expect(node).toMatchObject({ name: 'localhost', region: 'unknown' })
  })

  it.each([null, undefined, 'a string', 42, []])(
    'rejects %j, which is not an entry at all',
    (raw) => {
      expect(parseNode(raw)).toBeNull()
    },
  )
})

describe('parseFleet', () => {
  it('keeps the good entries and drops the rest', () => {
    const nodes = parseFleet([
      entry(),
      entry({ host: 'node-02.do-ams3.logos.test', peerId: '' }),
      'nonsense',
      entry({ host: 'node-03.gc-us-central1-a.logos.test' }),
    ])
    expect(nodes.map((node) => node.name)).toEqual(['node-01', 'node-03'])
  })

  it('returns nothing when the response is not a list', () => {
    expect(parseFleet({ nodes: [] })).toEqual([])
    expect(parseFleet(null)).toEqual([])
  })

  it('sorts by host so the order does not depend on the roster', () => {
    const nodes = parseFleet([
      entry({ host: 'node-02.do-ams3.logos.test' }),
      entry({ host: 'node-01.do-ams3.logos.test' }),
    ])
    expect(nodes.map((node) => node.name)).toEqual(['node-01', 'node-02'])
  })
})

describe('groupByRegion', () => {
  it('groups and orders regions', () => {
    const groups = groupByRegion(
      parseFleet([
        entry({ host: 'node-01.gc-us-central1-a.logos.test' }),
        entry({ host: 'node-01.do-ams3.logos.test' }),
        entry({ host: 'node-02.do-ams3.logos.test' }),
      ]),
    )
    expect(groups.map((group) => [group.region, group.nodes.length])).toEqual([
      ['do-ams3', 2],
      ['gc-us-central1-a', 1],
    ])
  })
})
