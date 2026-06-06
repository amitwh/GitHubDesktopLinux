import { test, expect } from '@playwright/test'

/**
 * E2E smoke test for the Meld window Phase 1a flow.
 *
 * NOTE: This test requires the packaged app to be running (yarn test:e2e:build:packaged
 * then yarn test:e2e:run:packaged). For local smoke testing, prefer running the
 * dev app via `yarn start` and manually opening a Meld window from the changes list.
 */
test.describe('Meld basic flow', () => {
  test.skip('opens Meld window from context menu and shows diff', async ({ page, context }) => {
    await page.goto('/')

    // Right-click on a changed file
    const fileRow = page.locator('[data-testid="changed-file"]').first()
    await expect(fileRow).toBeVisible({ timeout: 10_000 })
    await fileRow.click({ button: 'right' })

    await page.click('text=Open in Meld Window')

    // Wait for the Meld window to open
    const meldPage = await context.waitForEvent('page', { timeout: 10_000 })
    await meldPage.waitForLoadState('domcontentloaded')

    await expect(meldPage.locator('.meld-window')).toBeVisible()
    await expect(meldPage.locator('.meld-toolbar')).toBeVisible()
    await expect(meldPage.locator('.meld-file-tree')).toBeVisible()
    await expect(meldPage.locator('.meld-diff-pane')).toBeVisible()
  })

  test.skip('external tool dropdown lists configured tools', async ({ page, context }) => {
    await page.goto('/')
    const fileRow = page.locator('[data-testid="changed-file"]').first()
    await fileRow.click({ button: 'right' })
    await page.click('text=Open in Meld Window')
    const meldPage = await context.waitForEvent('page', { timeout: 10_000 })

    await meldPage.click('text=External tool')
    await expect(meldPage.locator('text=Meld')).toBeVisible()
    await expect(meldPage.locator('text=KDiff3')).toBeVisible()
  })
})
