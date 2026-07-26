import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as React from 'react'

import { DeleteWorktreeDialog } from '../../../src/ui/worktrees/delete-worktree-dialog'
import { render, screen, fireEvent } from '../../helpers/ui/render'
import { Repository } from '../../../src/models/repository'
import type { WorktreeDirtyState } from '../../../src/lib/git/worktree'

let restoreIpcSend: (() => void) | null = null

async function patchIpcSend() {
  const electron = await import('electron')
  const previousSend = electron.ipcRenderer.send
  electron.ipcRenderer.send = () => {}
  restoreIpcSend = () => {
    electron.ipcRenderer.send = previousSend
    restoreIpcSend = null
  }
}

afterEach(() => {
  if (restoreIpcSend !== null) {
    restoreIpcSend()
  }
})

const repo = {
  id: 1,
  path: '/path/to/repo',
  hash: 'abc',
  name: 'repo',
  lastFetched: null,
} as unknown as Repository

const worktreePath = '/path/to/repo-wt'

describe('DeleteWorktreeDialog', () => {
  beforeEach(async () => {
    await patchIpcSend()
  })

  it('renders the dirty warning when dirtyState is non-zero', () => {
    const dirtyState: WorktreeDirtyState = {
      modifiedCount: 2,
      untrackedCount: 3,
    }

    render(
      <DeleteWorktreeDialog
        repository={repo}
        worktreePath={worktreePath}
        askForConfirmationOnWorktreeRemoval={true}
        dirtyState={dirtyState}
        onDeleteWorktree={async () => {}}
        onConfirmWorktreeRemovalChanged={() => {}}
        onDismissed={() => {}}
      />
    )

    assert.ok(
      screen.getByText(/2 modified and 3 untracked files/) !== null
    )
  })

  it('does not render the dirty warning when dirtyState is zero', () => {
    const dirtyState: WorktreeDirtyState = {
      modifiedCount: 0,
      untrackedCount: 0,
    }

    render(
      <DeleteWorktreeDialog
        repository={repo}
        worktreePath={worktreePath}
        askForConfirmationOnWorktreeRemoval={true}
        dirtyState={dirtyState}
        onDeleteWorktree={async () => {}}
        onConfirmWorktreeRemovalChanged={() => {}}
        onDismissed={() => {}}
      />
    )

    assert.equal(screen.queryByText(/modified and/), null)
  })

  it('does not render the dirty warning when dirtyState is omitted', () => {
    render(
      <DeleteWorktreeDialog
        repository={repo}
        worktreePath={worktreePath}
        askForConfirmationOnWorktreeRemoval={true}
        onDeleteWorktree={async () => {}}
        onConfirmWorktreeRemovalChanged={() => {}}
        onDismissed={() => {}}
      />
    )

    assert.equal(screen.queryByText(/modified and/), null)
  })

  it('calls onDeleteWorktree with force=true when worktree is dirty', async () => {
    const dirtyState: WorktreeDirtyState = {
      modifiedCount: 1,
      untrackedCount: 0,
    }
    let lastForceArg: boolean | undefined

    const onDelete = async (
      _r: Repository,
      _p: string,
      force?: boolean
    ) => {
      lastForceArg = force
    }

    render(
      <DeleteWorktreeDialog
        repository={repo}
        worktreePath={worktreePath}
        askForConfirmationOnWorktreeRemoval={true}
        dirtyState={dirtyState}
        onDeleteWorktree={onDelete}
        onConfirmWorktreeRemovalChanged={() => {}}
        onDismissed={() => {}}
      />
    )

    // The force-confirm checkbox should be present.
    const checkbox = screen.getByLabelText(
      /I understand that uncommitted changes will be lost/
    )
    assert.ok(checkbox !== null)

    // Tick the force-confirm box.
    fireEvent.click(checkbox)

    // Submit the form via the Ok button (which is the destructive Delete
    // button — its label is "Delete").
    const okButton = screen.getByText('Delete') as HTMLButtonElement
    assert.ok(okButton !== null)
    fireEvent.click(okButton)

    // Wait for the async onDelete to fire. Node:test needs a tick.
    await new Promise(resolve => setImmediate(resolve))

    assert.strictEqual(lastForceArg, true)
  })

  it('calls onDeleteWorktree with force=false when worktree is clean', async () => {
    const dirtyState: WorktreeDirtyState = {
      modifiedCount: 0,
      untrackedCount: 0,
    }
    let lastForceArg: boolean | undefined

    const onDelete = async (
      _r: Repository,
      _p: string,
      force?: boolean
    ) => {
      lastForceArg = force
    }

    render(
      <DeleteWorktreeDialog
        repository={repo}
        worktreePath={worktreePath}
        askForConfirmationOnWorktreeRemoval={true}
        dirtyState={dirtyState}
        onDeleteWorktree={onDelete}
        onConfirmWorktreeRemovalChanged={() => {}}
        onDismissed={() => {}}
      />
    )

    const okButton = screen.getByText('Delete') as HTMLButtonElement
    fireEvent.click(okButton)

    await new Promise(resolve => setImmediate(resolve))

    assert.strictEqual(lastForceArg, false)
  })
})