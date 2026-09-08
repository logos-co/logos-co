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

/** The png fixture as Playwright wants it. */
const TILE_FILE = {
  name: TILE.name,
  mimeType: TILE.mimeType,
  buffer: readFileSync(join(FIXTURES, TILE.name)),
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

  test('records no type when the browser cannot name one', async ({ page }) => {
    // Same rule as a refused type, so a file with no extension and a file with
    // a refused one are explained the same way rather than diverging.
    //
    // Dropped rather than chosen through the input: Chrome reports an empty
    // type for a name it cannot map, like LICENSE or Dockerfile, but
    // `setInputFiles` substitutes application/octet-stream for an empty
    // mimeType and the case never arises.
    await page.evaluate(() => {
      const file = new File(['Apache License\nVersion 2.0\n'], 'LICENSE', {
        type: '',
      })
      const transfer = new DataTransfer()
      transfer.items.add(file)

      const zone = document.querySelector('[data-dropzone]')
      if (!zone) throw new Error('no dropzone')
      zone.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        })
      )
    })

    await expect(statValue(page, 'Type')).toHaveText('none')
    await expect(
      page.getByText('Your browser could not name a file type')
    ).toBeVisible()
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

  /**
   * A file no run has published before.
   *
   * Publishing is keyed by CID, so a fixed fixture means every run after the
   * first either finds its object already there, or races the propagation of
   * the delete that cleaned it up. Neither is what a person does. Unique bytes
   * make each run a genuine first publish.
   */
  const freshFile = (name: string, mimeType: string) => ({
    name,
    mimeType,
    buffer: Buffer.from(`logos-demos e2e ${Date.now()} ${Math.random()}\n`),
  })

  /**
   * Publish one file and follow the link it gives back.
   *
   * Run for a file that has a mimetype and one that does not, because those
   * are different code paths and only the first was covered once: the server
   * defaulted the missing mimetype, recomputed a different CID, and rejected
   * an upload that was perfectly honest. A png passed throughout.
   *
   * The CID is read off the page rather than asserted against a fixture. What
   * the CID should be is settled by the unit tests, against a real node; this
   * is about the round trip.
   */
  async function publishAndOpen(
    page: Page,
    file: { name: string; mimeType: string; buffer: Buffer }
  ) {
    await page.locator('input[type=file]').setInputFiles(file)

    const cid = await page.getByText(/^zDv/).first().innerText()
    await page.getByRole('button', { name: 'Get a shareable link' }).click()

    const link = page.getByRole('link', { name: new RegExp(cid) })
    await expect(link).toBeVisible()

    await page.goto((await link.innerText()).trim())

    // The integrity verdict, not the whole sentence, so rewording the copy
    // does not fail a test about whether the check passed.
    await expect(page.getByText(/^Verified\./)).toBeVisible()
    await expect(page.getByRole('heading', { name: file.name })).toBeVisible()

    return cid
  }

  test('publishes a link that opens and verifies', async ({ page }) => {
    test.skip(!(await sharingEnabled(page)), 'No store configured')

    const cid = await publishAndOpen(page, freshFile('note.txt', 'text/plain'))
    await expect(page.getByRole('heading', { name: 'note.txt' })).toBeVisible()
    expect(cid).toMatch(/^zDv/)
  })

  test('offers the shared link as something to click and to copy', async ({
    page,
    context,
  }) => {
    test.skip(!(await sharingEnabled(page)), 'No store configured')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.locator('input[type=file]').setInputFiles(TILE_FILE)

    await page.getByRole('button', { name: 'Get a shareable link' }).click()

    // A real link, opening away from the page rather than replacing it.
    const link = page.getByRole('link', { name: new RegExp(TILE.cid) })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('target', '_blank')

    await page.getByRole('button', { name: 'Copy the shareable link' }).click()
    await expect(
      page.getByRole('button', { name: /Copy the shareable/ })
    ).toHaveText('Copied')

    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain(TILE.cid)
  })

  test('lets the shared file be saved under its own name', async ({ page }) => {
    test.skip(!(await sharingEnabled(page)), 'No store configured')

    // A name a browser reports no type for, which is the case that renders
    // nothing inline and so depends entirely on saving.
    const file = freshFile('LICENSE', '')
    await publishAndOpen(page, file)

    const download = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Download' }).click()

    expect((await download).suggestedFilename()).toBe(file.name)
  })

  test('publishes a file whose type a node would refuse', async ({ page }) => {
    test.skip(!(await sharingEnabled(page)), 'No store configured')

    // The README case: text/markdown is refused, so this publishes with no
    // type at all, and the server has to agree about that or reject the CID.
    await publishAndOpen(page, freshFile('notes.md', 'text/markdown'))
  })

  test('refuses a CID that has nothing published under it', async ({
    page,
  }) => {
    await page.goto(`/storage/c/${TILE.cid.slice(0, -4)}zzzz`)
    await expect(
      page.getByText(/nothing has been published under it/)
    ).toBeVisible()
  })

  test('rejects something that is not a CID at all', async ({ page }) => {
    await page.goto('/storage/c/not-a-cid')
    await expect(
      page.getByText('That is not a Logos Storage content address.')
    ).toBeVisible()
  })
})
