/**
 * Every demo says where its claims can be checked.
 *
 * The links are the point, so this asserts they are real links that leave the
 * page safely, and that the set matches the data rather than a copy of it.
 */
import { expect, test, type Page } from '@playwright/test'

import { ORGS, referencesFor } from '../src/demos/references'
import { DEMOS } from '../src/demos/registry'

const referenceLinks = (page: Page) =>
  page.getByRole('region', { name: 'References' }).getByRole('link')

test.describe('references', () => {
  for (const demo of DEMOS) {
    const items = referencesFor(demo.href)

    test(`${demo.label} lists what it talks to`, async ({ page }) => {
      await page.goto(demo.href)

      await expect(
        page.getByRole('heading', { name: 'References' })
      ).toBeVisible()

      for (const item of items) {
        // Located by href, which is unique. Labels are not: `logos-delivery`
        // is a prefix of `logos-delivery-js`.
        const link = referenceLinks(page).filter({ hasText: item.label })
        const byHref = page.locator(`a[href="${item.href}"]`)

        await expect(byHref, item.label).toHaveCount(1)
        await expect(byHref).toContainText(item.label)
        await expect(link.first()).toBeVisible()

        // These leave the page, so they open elsewhere and drop the opener.
        await expect(byHref).toHaveAttribute('target', '_blank')
        await expect(byHref).toHaveAttribute('rel', 'noopener noreferrer')
      }
    })

    test(`${demo.label} lists nothing it does not use`, async ({ page }) => {
      await page.goto(demo.href)

      // A reference that drifts out of the data is worse than none: it claims
      // the demo touches something it does not.
      await expect(referenceLinks(page)).toHaveCount(items.length)
    })
  }

  test('the sidebar points at the organisations', async ({ page }) => {
    await page.goto('/')

    for (const org of ORGS) {
      const link = page.getByRole('link', { name: org.label, exact: true })
      await expect(link, org.label).toHaveAttribute('href', org.href)
      await expect(link).toHaveAttribute('target', '_blank')
    }
  })
})
