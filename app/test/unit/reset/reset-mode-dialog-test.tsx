import assert from 'node:assert'
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import * as React from 'react'

import { Commit } from '../../../src/models/commit'
import { CommitIdentity } from '../../../src/models/commit-identity'
import { Repository } from '../../../src/models/repository'
import { GitResetMode } from '../../../src/lib/git'
import type { Dispatcher } from '../../../src/ui/dispatcher'
import { fireEvent, render, screen } from '../../helpers/ui/render'

/**
 * The global electron mock in `globals.mts` only sets up `ipcRenderer.on`.
 * The Dialog component (which ResetModeDialog wraps) calls
 * `ipcRenderer.send` from `componentDidMount` to notify the main process
 * that a dialog has opened, so we extend the mock with a no-op `send`
 * before the dialog module loads.
 */
;(async () => {
  const electron = await import('electron')
  ;(electron.ipcRenderer as any).send = () => {}
})()

function makeCommit(sha: string): Commit {
  const identity = new CommitIdentity(
    'Test Author',
    'test@example.com',
    new Date(0)
  )
  return new Commit(
    sha,
    sha.slice(0, 7),
    `summary ${sha.slice(0, 7)}`,
    'body',
    identity,
    identity,
    ['parent'],
    [],
    []
  )
}

function makeRepository(): Repository {
  return new Repository('/tmp/desktop-fixture', 1, null, false)
}

class FakeDispatcher {
  public resetCalls = new Array<{
    readonly commitSha: string
    readonly mode: GitResetMode
    readonly showConfirmationDialog: boolean
  }>()

  public async resetToCommit(
    _repository: Repository,
    commit: Commit,
    mode: GitResetMode,
    showConfirmationDialog: boolean
  ): Promise<void> {
    this.resetCalls.push({
      commitSha: commit.sha,
      mode,
      showConfirmationDialog,
    })
  }
}

// Lazy-load the dialog module so the ipcRenderer mock above is in effect
// by the time the module evaluates (it transitively imports the Dialog
// component, which captures `ipcRenderer.send` at module load).
const DialogLazy = () =>
  import('../../../src/ui/reset/reset-mode-dialog').then(m => m.ResetModeDialog)

describe('ResetModeDialog', () => {
  let dispatcher: FakeDispatcher
  let repository: Repository
  let commit: Commit
  let Dialog: Awaited<ReturnType<typeof DialogLazy>>

  before(async () => {
    Dialog = await DialogLazy()
  })

  beforeEach(() => {
    dispatcher = new FakeDispatcher()
    repository = makeRepository()
    commit = makeCommit('a'.repeat(40))
  })

  afterEach(() => {
    // No per-test teardown needed — the shared render helper cleans up the
    // DOM in `afterEach` (see `app/test/helpers/ui/setup.ts`).
  })

  it('mounts with all three reset mode options visible', () => {
    // Dialog content lives inside a <dialog> element which jsdom doesn't
    // render as open by default, so we walk the container directly.
    const { container } = render(
      <Dialog
        dispatcher={dispatcher as unknown as Dispatcher}
        repository={repository}
        commit={commit}
        onDismissed={() => {}}
      />
    )

    const text = container.textContent ?? ''
    assert.ok(text.includes('Soft'))
    assert.ok(text.includes('Mixed'))
    assert.ok(text.includes('Hard'))
  })

  it('defaults to Mixed mode and dispatches resetToCommit with showConfirmationDialog=false', async () => {
    const onDismissed = mock.fn()
    render(
      <Dialog
        dispatcher={dispatcher as unknown as Dispatcher}
        repository={repository}
        commit={commit}
        onDismissed={onDismissed}
      />
    )

    // Reset button — text follows platform mnemonic so we match by a
    // stable substring. The dialog content lives in a <dialog> element
    // which jsdom doesn't render as open by default, so we pass
    // `hidden: true` to the role query.
    const resetButton = screen.getByRole('button', {
      name: /Reset/,
      hidden: true,
    }) as HTMLButtonElement

    fireEvent.click(resetButton)
    // Let the async resetToCommit settle.
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))

    assert.strictEqual(dispatcher.resetCalls.length, 1)
    assert.strictEqual(dispatcher.resetCalls[0].mode, GitResetMode.Mixed)
    assert.strictEqual(dispatcher.resetCalls[0].commitSha, commit.sha)
    assert.strictEqual(dispatcher.resetCalls[0].showConfirmationDialog, false)
    assert.strictEqual((onDismissed as any).mock.callCount(), 1)
  })

  it('switches the selected mode via the radio group and dispatches the new mode', async () => {
    render(
      <Dialog
        dispatcher={dispatcher as unknown as Dispatcher}
        repository={repository}
        commit={commit}
        onDismissed={() => {}}
      />
    )

    const softRadio = screen.getByRole('radio', {
      name: /Soft/,
      hidden: true,
    }) as HTMLInputElement
    fireEvent.click(softRadio)

    const resetButton = screen.getByRole('button', {
      name: /Reset/,
      hidden: true,
    }) as HTMLButtonElement
    fireEvent.click(resetButton)
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))

    assert.strictEqual(dispatcher.resetCalls.length, 1)
    assert.strictEqual(dispatcher.resetCalls[0].mode, GitResetMode.Soft)
  })

  it('unmounts cleanly when the user cancels without invoking resetToCommit', () => {
    const onDismissed = mock.fn()
    const view = render(
      <Dialog
        dispatcher={dispatcher as unknown as Dispatcher}
        repository={repository}
        commit={commit}
        onDismissed={onDismissed}
      />
    )

    const cancelButton = screen.getByRole('button', {
      name: /Cancel/,
      hidden: true,
    })
    fireEvent.click(cancelButton)

    assert.strictEqual(dispatcher.resetCalls.length, 0)
    // The shared render setup's `afterEach` runs `cleanup()` so we just
    // verify no error was thrown above.
    assert.ok(view.container)
  })
})
