/**
 * A node refuses a Content-Type it cannot map to a file extension.
 *
 * Each expectation below was checked against a running node (v0.4.5) by
 * uploading with that Content-Type: the accepted ones returned a CID, the
 * refused ones returned 422 "The MIME type ... is not valid."
 */
import { describe, expect, it } from 'vitest'

import { isAcceptedMimetype } from './storage-mimetypes'

describe('isAcceptedMimetype', () => {
  it.each([
    'text/plain',
    'image/png',
    'image/jpeg',
    'application/json',
    'application/pdf',
    'video/mp4',
    'application/octet-stream',
  ])('accepts %s', (mimetype) => {
    expect(isAcceptedMimetype(mimetype)).toBe(true)
  })

  it('refuses text/markdown', () => {
    // The one that matters in practice: browsers report it for every .md file,
    // so dropping a README on the page hits this path.
    expect(isAcceptedMimetype('text/markdown')).toBe(false)
  })

  it('refuses a type nothing maps to', () => {
    expect(isAcceptedMimetype('application/x-made-up')).toBe(false)
  })

  it('treats no Content-Type as fine, because the node does', () => {
    // An empty header is not an error there; the field is simply left out.
    expect(isAcceptedMimetype('')).toBe(true)
  })

  it('ignores parameters and case', () => {
    expect(isAcceptedMimetype('text/plain;charset=utf-8')).toBe(true)
    expect(isAcceptedMimetype('IMAGE/PNG')).toBe(true)
  })
})
