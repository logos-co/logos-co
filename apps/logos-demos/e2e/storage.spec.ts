/**
 * The storage demo, end to end.
 *
 * The CIDs asserted here came from a real Logos Storage node (v0.4.5), not
 * from the code under test — the same fixtures the unit tests use. What this
 * adds is the path a person actually takes: a real file through a real file
 * input, and the shared link opened as a fresh page.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

const FIXTURES = join(import.meta.dirname, 'fixtures')

/** Uploaded as `text/markdown`, which is what a browser reports for a .md. */
const NOTES = {
  name: 'notes.md',
  mimeType: 'text/markdown',
  /**
   * A node refuses `text/markdown`, so the page falls back to no mimetype at
   * all. This is the CID that node returns for the same bytes uploaded with no
   * Content-Type.
   */
  cid: 'zDvZRwzm7QQ22dbaUn7ewnPiMw1vgaRyxZNGUsGJZMyJcwtn7TfF',
}

const TILE = {
  name: 'tile.png',
  mimeType: 'image/png',
  cid: 'zDvZRwzmAMXgt6gr8bn9t9JSpLX3DwLz71sL2ypESNc8rbTUePow',
}

async function drop(page: Page, file: { name: string; mimeType: string }) {
  await page.locator('input[type=file]').setInputFiles({
    name: file.name,
    mimeType: file.mimeType,
    buffer: readFileSync(join(FIXTURES, file.name)),
  })
}

/**
 * Open the demo and wait until its client code is actually running.
 *
 * The markup arrives prerendered, so the file input exists before React has
 * attached anything to it. Setting files in that window dispatches a change
 * event into nothing and the page never reacts — which is exactly how this
 * failed the first time. The panel asks the server whether it can publish as
 * soon as it mounts, so that request is a precise signal that the component is
 * live, and unlike the roster it does not depend on anything outside this app.
 */
async function openDemo(page: Page) {
  const hydrated = page.waitForResponse((response) =>
    response.url().includes('/api/storage/content')
  )
  await page.goto('/storage')
  await hydrated
}

/**
 * The value shown against one of the panel's labels.
 *
 * The labels are uppercased by CSS, so they read `BLOCKS` on screen but are
 * `Blocks` in the DOM, which is what a locator sees.
 */
function statValue(page: Page, label: string) {
  return page.getByRole('term').filter({ hasText: label }).locator('+ dd')
}

/** Whether this deployment has a store wired up. */
async function sharingEnabled(page: Page): Promise<boolean> {
  const response = await page.request.get('/api/storage/content')
  if (!response.ok()) return false
  return Boolean((await response.json()).enabled)
}

test.describe('storage demo', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page)
  })

  test('gives a file the CID a node would', async ({ page }) => {
    await drop(page, TILE)

    await expect(page.getByText(TILE.cid)).toBeVisible()
    await expect(statValue(page, 'Blocks')).toHaveText('1')
    await expect(statValue(page, 'Type')).toHaveText('image/png')
  })

  test('falls back to no mimetype when a node would refuse the type', async ({
    page,
  }) => {
    // The case that sent us here: a README reports as text/markdown, which the
    // node rejects outright, so the CID has to describe an upload with none.
    await drop(page, NOTES)

    await expect(page.getByText(NOTES.cid)).toBeVisible()
    await expect(statValue(page, 'Type')).toHaveText('none')
    await expect(
      page.getByText(/text\/markdown, which a Logos Storage node refuses/)
    ).toBeVisible()
  })

  test('says plainly whether it can publish, and never shows a dead button', async ({
    page,
  }) => {
    await drop(page, TILE)

    const button = page.getByRole('button', { name: 'Get a shareable link' })
    const notice = page.getByText('Sharing is off in this deployment')

    // Exactly one of the two, and only once the server has answered — the bug
    // this replaced showed the notice on a deployment that could publish.
    if (await sharingEnabled(page)) {
      await expect(button).toBeVisible()
      await expect(notice).toHaveCount(0)
    } else {
      await expect(notice).toBeVisible()
      await expect(button).toHaveCount(0)
    }
  })

  test('publishes a link that opens and verifies', async ({ page }) => {
    test.skip(!(await sharingEnabled(page)), 'No store configured')

    await drop(page, TILE)
    await page.getByRole('button', { name: 'Get a shareable link' }).click()

    const link = page.getByText(/\/storage\/c\/zD/)
    await expect(link).toBeVisible()

    const shared = (await link.innerText()).trim()
    expect(shared).toContain(TILE.cid)

    await page.goto(shared)

    await expect(page.getByRole('img', { name: TILE.cid })).toBeVisible()
    await expect(
      page.getByText('These bytes hash to the CID in the URL')
    ).toBeVisible()
  })

  test('refuses a CID that has nothing published under it', async ({
    page,
  }) => {
    await page.goto(`/storage/c/${TILE.cid.slice(0, -4)}zzzz`)
    await expect(
      page.getByText(/Nothing is published under that CID/)
    ).toBeVisible()
  })

  test('rejects something that is not a CID at all', async ({ page }) => {
    await page.goto('/storage/c/not-a-cid')
    await expect(
      page.getByText('That is not a Logos Storage CID.')
    ).toBeVisible()
  })
})
