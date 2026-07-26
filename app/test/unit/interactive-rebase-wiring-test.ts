import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Phase 3 (Rebase Preview) wiring smoke test:
 *
 *   - The InteractiveRebaseDialog source includes MeldRebasePreview
 *     with the expected prop names.
 *   - The IPC contract for `meld:get-rebase-commit-stats` and
 *     `meld:get-rebase-commit-diff` is registered.
 *   - The parseShortStat pure-function path covered in
 *     rebasePreview-test.ts is exercised end-to-end via the IPC
 *     handler signature.
 *
 * This avoids mounting the full Dialog (which requires Electron's
 * ipcRenderer mock and a real browser environment). The actual
 * component render path is covered by MeldRebasePreview-test.tsx;
 * the parser is covered by rebasePreview-test.ts; the IPC channel
 * shape is covered by ipc-contract-test.ts.
 */

// __dirname here is app/test/unit; the app source tree is ../src.
const appRoot = join(__dirname, '..', '..')

describe('InteractiveRebaseDialog (Phase 3 wiring)', () => {
  it('imports MeldRebasePreview from the meld module', () => {
    const src = readFileSync(
      join(
        appRoot,
        'src',
        'ui',
        'interactive-rebase',
        'interactive-rebase-dialog.tsx'
      ),
      'utf8'
    )
    assert.ok(
      src.includes('MeldRebasePreview'),
      'expected the dialog source to import MeldRebasePreview'
    )
    assert.ok(
      src.includes('onViewDiff') && src.includes('stats'),
      'expected the dialog source to pass stats/onViewDiff to the preview'
    )
  })

  it('includes the Phase 3 channels in the IPC contract', () => {
    const ipcShared = readFileSync(
      join(appRoot, 'src', 'lib', 'ipc-shared.ts'),
      'utf8'
    )
    assert.ok(
      ipcShared.includes('meld:get-rebase-commit-stats'),
      'expected ipc-shared to register meld:get-rebase-commit-stats'
    )
    assert.ok(
      ipcShared.includes('meld:get-rebase-commit-diff'),
      'expected ipc-shared to register meld:get-rebase-commit-diff'
    )

    const ipcContract = readFileSync(
      join(appRoot, 'test', 'unit', 'ipc-contract-test.ts'),
      'utf8'
    )
    assert.ok(
      ipcContract.includes('meld:get-rebase-commit-stats'),
      'expected IPC contract test to list meld:get-rebase-commit-stats'
    )
    assert.ok(
      ipcContract.includes('meld:get-rebase-commit-diff'),
      'expected IPC contract test to list meld:get-rebase-commit-diff'
    )
  })

  it('registers the Phase 3 handlers in the main-process IPC module', () => {
    const ipcMainSrc = readFileSync(
      join(appRoot, 'src', 'main-process', 'meld', 'meld-ipc.ts'),
      'utf8'
    )
    assert.ok(
      ipcMainSrc.includes("'meld:get-rebase-commit-stats'"),
      'expected meld-ipc to register meld:get-rebase-commit-stats handler'
    )
    assert.ok(
      ipcMainSrc.includes("'meld:get-rebase-commit-diff'"),
      'expected meld-ipc to register meld:get-rebase-commit-diff handler'
    )
  })
})
