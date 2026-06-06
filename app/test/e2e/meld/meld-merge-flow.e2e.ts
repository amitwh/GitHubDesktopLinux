import { test, expect } from '@playwright/test'

/**
 * E2E smoke test for the Meld window Phase 1c three-way merge flow.
 *
 * NOTE: This test requires the packaged app to be running (yarn test:e2e:build:packaged
 * then yarn test:e2e:run:packaged). For local smoke testing, prefer running the
 * dev app via `yarn start`, creating a real merge conflict, and manually
 * opening the Meld window from the merge-conflict dialog.
 *
 * Skipped by default — the existing CI environment doesn't have a git repo
 * with an in-progress merge ready to drive this flow.
 */
test.describe('Meld 3-way merge flow', () => {
  test.skip('opens merge mode from conflict dialog and resolves a hunk', async ({
    page,
    context,
  }) => {
    // 1. Open the app's main window and trigger a merge-conflict dialog
    await page.goto('/')
    const conflictRow = page.locator('[data-testid="conflicted-file"]').first()
    await expect(conflictRow).toBeVisible({ timeout: 10_000 })

    // 2. Click "Open in Meld Window" on the first conflicted file
    await conflictRow.locator('text=Open in Meld Window').click()

    // 3. Wait for the new Meld window
    const meldPage = await context.waitForEvent('page', { timeout: 10_000 })
    await meldPage.waitForLoadState('domcontentloaded')

    // 4. Verify the 3-way layout is rendered
    await expect(meldPage.locator('.meld-window')).toBeVisible()
    await expect(meldPage.locator('.meld-three-way-view')).toBeVisible()
    await expect(meldPage.locator('.meld-merged-pane')).toBeVisible()
    await expect(meldPage.locator('.meld-merge-controls')).toBeVisible()

    // 5. Accept LOCAL on the first hunk
    const acceptLocal = meldPage.locator('[data-testid="resolve-local-0"]')
    await expect(acceptLocal).toBeVisible()
    await acceptLocal.click()

    // 6. The textarea content should no longer contain the marker for hunk 0
    const textarea = meldPage.locator('[data-testid="merged-textarea"]')
    await expect(textarea).not.toContainText('<<<<<<< HEAD')

    // 7. Click Mark as resolved
    const markBtn = meldPage.locator(
      '[data-testid="meld-merge-controls-mark-resolved"]',
    )
    await expect(markBtn).toBeEnabled()
    await markBtn.click()

    // 8. The original window's conflict list should no longer show the file
    //    (we just verify the dialog can be re-opened cleanly — the file row
    //    is gone or marked as resolved)
    await page.click('text=Close')
    await conflictRow.first().waitFor({ state: 'detached', timeout: 5_000 })
  })
})
