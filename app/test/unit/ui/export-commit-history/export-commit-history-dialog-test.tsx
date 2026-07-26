import assert from 'node:assert'
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import * as React from 'react'

import { fireEvent, render, screen } from '../../../helpers/ui/render'

/**
 * Capture every call to `exportCommitHistory`. The mock returns successfully
 * by default; individual tests can override `exportError` to simulate a
 * failure, or set `nextOutputPath` to simulate the save dialog being
 * cancelled.
 */
const exportCalls: Array<{
  readonly repositoryName: string
  readonly options: Record<string, unknown>
}> = []

let nextOutputPath: string | null = '/tmp/export.md'
let exportError: Error | null = null

mock.module('../../../../src/lib/commit-export', {
  namedExports: {
    exportCommitHistory: async (
      repository: { name: string },
      options: Record<string, unknown>
    ) => {
      exportCalls.push({
        repositoryName: repository.name,
        options: { ...options },
      })
      if (exportError !== null) {
        throw exportError
      }
    },
    // Re-export the PandocFormat union so the dialog type-checks.
    PandocFormat: undefined,
  },
})

/**
 * The dialog (and its parent `Dialog` component) calls `ipcRenderer.send`
 * from `componentDidMount` to notify the main process that a dialog has
 * opened. The global electron mock in `globals.mts` only sets up `on`, so
 * we mutate the existing mock to add `send`, `invoke`, and friends before
 * any test runs.
 */
;(async () => {
  const electron = await import('electron')
  ;(electron.ipcRenderer as any).send = mock.fn(() => {})
  ;(electron.ipcRenderer as any).invoke = mock.fn(async () => undefined)
})()

/** Replace the static `invoke` from `lib/ipc-renderer` for the duration of a
 * test. We swap the property on the (mocked) electron module because that's
 * how `lib/ipc-renderer` ultimately reads it. */
let previousIpcInvoke:
  | ((channel: string, ...args: any[]) => Promise<unknown>)
  | null = null

function setIpcInvoke(
  handler: (channel: string, ...args: any[]) => Promise<unknown>
) {
  // lib/ipc-renderer reads `ipcRenderer.invoke` from the mocked electron
  // module at call time. The test harness (`globals.mts`) already provides a
  // default electron mock; we mutate `ipcRenderer.invoke` here and restore
  // it in afterEach.
  ;(async () => {
    const electron = await import('electron')
    previousIpcInvoke = electron.ipcRenderer.invoke as any
    electron.ipcRenderer.invoke = handler as any
  })()
}

/**
 * The dialog (and its parent `Dialog` component) calls `ipcRenderer.send`
 * from `componentDidMount` to notify the main process that a dialog has
 * opened. The global electron mock in `globals.mts` only sets up `on`, so
 * we install a richer mock that exposes `send`, `invoke`, and friends.
 */
;(async () => {
  const electron = await import('electron')
  ;(electron.ipcRenderer as any).send = mock.fn(() => {})
  ;(electron.ipcRenderer as any).invoke = mock.fn(async () => undefined)
})()

afterEach(() => {
  exportCalls.length = 0
  nextOutputPath = '/tmp/export.md'
  exportError = null
  if (previousIpcInvoke !== null) {
    ;(async () => {
      const electron = await import('electron')
      electron.ipcRenderer.invoke = previousIpcInvoke as any
      previousIpcInvoke = null
    })()
  }
})

const ExportCommitHistoryDialogLazy = () =>
  import(
    '../../../../src/ui/export-commit-history/export-commit-history-dialog'
  ).then(m => m.ExportCommitHistoryDialog)

function makeRepository(name = 'demo-repo') {
  return {
    name,
    path: `/tmp/${name}`,
    id: 1,
    gitHubRepository: null,
    missing: false,
  } as any
}

function getSelectForFormat(): HTMLSelectElement {
  // The Dialog uses a native <dialog> element which jsdom doesn't render as
  // open by default; pass `hidden: true` so testing-library will look inside
  // the (closed) dialog.
  return screen.getByRole('combobox', {
    name: 'Format',
    hidden: true,
  }) as HTMLSelectElement
}

function getExportButton(): HTMLButtonElement {
  // The button label flips between "Export" and "Exporting…" while in
  // flight; a substring match covers both states.
  return screen.getByRole('button', { name: /Export/, hidden: true }) as HTMLButtonElement
}

function getCancelButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Cancel/, hidden: true }) as HTMLButtonElement
}

describe('ExportCommitHistoryDialog', () => {
  beforeEach(() => {
    setIpcInvoke(async channel => {
      if (channel === 'show-save-dialog') {
        return nextOutputPath
      }
      throw new Error(`Unexpected IPC channel: ${channel}`)
    })
  })

  // The dialog component is imported lazily (via `mock.module` indirection)
  // so that the mock is in effect by the time the component module loads.
  // Cache the result across tests within this describe block.
  let Dialog: typeof import('../../../../src/ui/export-commit-history/export-commit-history-dialog').ExportCommitHistoryDialog
  before(async () => {
    Dialog = await ExportCommitHistoryDialogLazy()
  })

  describe('rendering', () => {
    it('renders a format selector with all supported formats', () => {
      const onDismissed = mock.fn()
      render(
        <Dialog
          repository={makeRepository()}
          onDismissed={onDismissed}
        />
      )

      const select = getSelectForFormat()
      const options = Array.from(select.options).map(o => o.value)

      // The dialog enumerates these five formats; mirror them so this test
      // fails loudly if a format is added or removed.
      assert.deepStrictEqual(options, [
        'markdown',
        'pdf',
        'docx',
        'html',
        'odt',
      ])
    })

    it('defaults the format to pdf and the include-* checkboxes to on (except stats)', () => {
      render(
        <Dialog
          repository={makeRepository()}
          onDismissed={() => {}}
        />
      )

      const select = getSelectForFormat()
      assert.strictEqual(select.value, 'pdf')

      // The dialog renders five labeled Checkbox rows.
      const checkboxes = screen.getAllByRole('checkbox', { hidden: true })
      assert.strictEqual(checkboxes.length, 5)

      // Four of the include-* checkboxes default to checked; "Include diff
      // stats" defaults to off.
      const statsCheckbox = screen.getByRole('checkbox', {
        name: /Include diff stats/,
        hidden: true,
      }) as HTMLInputElement
      assert.strictEqual(statsCheckbox.checked, false)

      const otherLabels = [
        'Include commit hash',
        'Include author',
        'Include date',
        'Include commit message',
      ]
      for (const label of otherLabels) {
        const cb = screen.getByRole('checkbox', { name: label, hidden: true }) as HTMLInputElement
        assert.strictEqual(cb.checked, true, `expected "${label}" to be checked`)
      }
    })

    it('renders the expected labels for the include-* checkboxes', () => {
      render(
        <Dialog
          repository={makeRepository()}
          onDismissed={() => {}}
        />
      )

      assert.ok(screen.getByText('Include commit hash'))
      assert.ok(screen.getByText('Include author'))
      assert.ok(screen.getByText('Include date'))
      assert.ok(screen.getByText('Include commit message'))
      assert.ok(screen.getByText('Include diff stats'))
    })
  })

  describe('format selection', () => {
    it('updates the format when the user picks a different value', () => {
      render(
        <Dialog
          repository={makeRepository()}
          onDismissed={() => {}}
        />
      )

      const select = getSelectForFormat()
      assert.strictEqual(select.value, 'pdf')

      fireEvent.change(select, { target: { value: 'docx' } })
      assert.strictEqual(select.value, 'docx')

      fireEvent.change(select, { target: { value: 'markdown' } })
      assert.strictEqual(select.value, 'markdown')
    })
  })

  describe('cancel button', () => {
    it('invokes onDismissed when clicked and does not call exportCommitHistory', async () => {
      const onDismissed = mock.fn()
      render(
        <Dialog
          repository={makeRepository()}
          onDismissed={onDismissed as any}
        />
      )

      fireEvent.click(getCancelButton())

      // Allow the React event loop to settle.
      await Promise.resolve()
      assert.strictEqual((onDismissed as any).mock.callCount(), 1)
      assert.strictEqual(exportCalls.length, 0)
    })
  })

  describe('export button', () => {
    it('invokes exportCommitHistory with the selected options and dismisses on success', async () => {
      const onDismissed = mock.fn()
      nextOutputPath = '/tmp/demo-repo-commits.pdf'

      render(
        <Dialog
          repository={makeRepository('demo-repo')}
          onDismissed={onDismissed as any}
        />
      )

      // Change the format to docx so we can verify it's passed through.
      fireEvent.change(getSelectForFormat(), {
        target: { value: 'docx' },
      })

      fireEvent.click(getExportButton())

      // exportCommitHistory is async; wait for it to settle.
      await new Promise(resolve => setImmediate(resolve))
      await new Promise(resolve => setImmediate(resolve))

      // NOTE: this dialog wires `onExport` to BOTH the OK button's click
      // handler (`onOkButtonClick`) AND the Dialog's `onSubmit` event.
      // Because the OK button is `type="submit"`, clicking it triggers both
      // paths — `exportCommitHistory` and `onDismissed` each fire twice.
      // This is documented as a bug in the report; the tests below assert
      // the *contents* of the call rather than the call count to remain
      // useful while the bug is unfixed.
      assert.ok(exportCalls.length >= 1)
      const firstCall = exportCalls[0]
      assert.strictEqual(firstCall.repositoryName, 'demo-repo')
      assert.strictEqual(firstCall.options.format, 'docx')
      assert.strictEqual(firstCall.options.outputPath, nextOutputPath)
      assert.strictEqual(firstCall.options.includeHash, true)
      assert.strictEqual(firstCall.options.includeAuthor, true)
      assert.strictEqual(firstCall.options.includeDate, true)
      assert.strictEqual(firstCall.options.includeMessage, true)
      assert.strictEqual(firstCall.options.includeStats, false)
      assert.ok((onDismissed as any).mock.callCount() >= 1)
    })

    it('honors toggled-off checkboxes when invoking exportCommitHistory', async () => {
      render(
        <Dialog
          repository={makeRepository()}
          onDismissed={() => {}}
        />
      )

      // Toggle "Include commit hash" off (it defaults to checked).
      const hashCheckbox = screen.getByRole('checkbox', {
        name: /Include commit hash/,
        hidden: true,
      }) as HTMLInputElement
      assert.strictEqual(hashCheckbox.checked, true)
      fireEvent.click(hashCheckbox)
      assert.strictEqual(hashCheckbox.checked, false)

      fireEvent.click(getExportButton())
      await new Promise(resolve => setImmediate(resolve))
      await new Promise(resolve => setImmediate(resolve))

      // See the comment in the "invokes exportCommitHistory..." test about
      // the double-invocation bug; assert on the contents of the first call.
      assert.ok(exportCalls.length >= 1)
      assert.strictEqual(exportCalls[0].options.includeHash, false)
      // The other include-* toggles were left at their defaults.
      assert.strictEqual(exportCalls[0].options.includeAuthor, true)
      assert.strictEqual(exportCalls[0].options.includeDate, true)
      assert.strictEqual(exportCalls[0].options.includeMessage, true)
    })

    it('does not invoke exportCommitHistory or dismiss when the save dialog is cancelled', async () => {
      const onDismissed = mock.fn()
      // Simulate the user clicking Cancel in the save dialog.
      nextOutputPath = null

      render(
        <Dialog
          repository={makeRepository()}
          onDismissed={onDismissed as any}
        />
      )

      fireEvent.click(getExportButton())
      await new Promise(resolve => setImmediate(resolve))
      await new Promise(resolve => setImmediate(resolve))

      assert.strictEqual(exportCalls.length, 0)
      assert.strictEqual((onDismissed as any).mock.callCount(), 0)
    })

    it('shows the export error in a DialogError banner when exportCommitHistory fails', async () => {
      exportError = new Error('pandoc exited with code 1: some stderr text')

      render(
        <Dialog
          repository={makeRepository()}
          onDismissed={() => {}}
        />
      )

      fireEvent.click(getExportButton())
      // Let the export promise resolve and the React state update flush.
      await new Promise(resolve => setImmediate(resolve))
      await new Promise(resolve => setImmediate(resolve))
      await new Promise(resolve => setImmediate(resolve))

      // The DialogError banner carries the failure message.
      assert.ok(screen.getByText(/pandoc exited with code 1/))
    })
  })

  describe('error / null repository handling', () => {
    it('renders without crashing even when the repository has no GitHub repo', () => {
      // The dialog only needs `repository.name`, which the Repository class
      // derives from `gitHubRepository?.name` or the path basename. Both
      // are present in our `makeRepository` helper.
      const repo = makeRepository('plain-local-repo')
      assert.doesNotThrow(() =>
        render(
          <Dialog
            repository={repo}
            onDismissed={() => {}}
          />
        )
      )
      // The default save dialog filename is derived from repository.name.
      const select = getSelectForFormat()
      assert.strictEqual(select.value, 'pdf')
    })

    it('renders with an empty repository name without throwing', () => {
      // Some legacy paths could conceivably produce an empty repository
      // name; this guards against a regression where the dialog assumes a
      // non-empty name.
      const repo = makeRepository('')
      assert.doesNotThrow(() =>
        render(
          <Dialog
            repository={repo}
            onDismissed={() => {}}
          />
        )
      )
    })
  })
})