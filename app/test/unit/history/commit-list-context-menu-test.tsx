import assert from 'node:assert'
import { describe, it } from 'node:test'

import {
  buildCommitContextMenu,
  type ICommitContextMenuInputs,
} from '../../../src/ui/history/commit-list'
import { Commit } from '../../../src/models/commit'
import { CommitIdentity } from '../../../src/models/commit-identity'
import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { IMenuItem } from '../../../src/lib/menu-item'

function makeCommit(sha: string, tags: ReadonlyArray<string> = []): Commit {
  const identity = new CommitIdentity(
    'Test Author',
    'test@example.com',
    new Date(0)
  )
  return new Commit(
    sha,
    sha.slice(0, 7),
    `summary for ${sha.slice(0, 7)}`,
    'body',
    identity,
    identity,
    ['parent-sha'],
    [],
    tags
  )
}

function makeInputs(
  overrides: Partial<ICommitContextMenuInputs> = {}
): ICommitContextMenuInputs {
  const commit = overrides.commit ?? makeCommit('a'.repeat(40))
  return {
    row: overrides.row ?? 1,
    commit,
    localCommitSHAs: overrides.localCommitSHAs ?? [commit.sha],
    canUndoCommits: overrides.canUndoCommits,
    canAmendCommits: overrides.canAmendCommits,
    canResetToCommits: overrides.canResetToCommits ?? true,
    gitHubRepository: overrides.gitHubRepository ?? null,
    isLocalCommit: overrides.isLocalCommit ?? (() => true),
    canReorder: overrides.canReorder ?? (() => false),
    canCherryPick: overrides.canCherryPick ?? (() => false),
    getDeleteTagsMenuItem:
      overrides.getDeleteTagsMenuItem ?? (() => null),
    onAmendCommit: overrides.onAmendCommit,
    onUndoCommit: overrides.onUndoCommit,
    onResetToCommit: overrides.onResetToCommit,
    onRevertCommit: overrides.onRevertCommit,
    onCreateBranch: overrides.onCreateBranch,
    onCheckoutCommit: overrides.onCheckoutCommit,
    onCreateTag: overrides.onCreateTag,
    onCherryPick: overrides.onCherryPick,
    onKeyboardReorder: overrides.onKeyboardReorder,
    onViewCommitOnGitHub: overrides.onViewCommitOnGitHub,
    selectedCommits: overrides.selectedCommits ?? [commit],
  }
}

function findItem(items: ReadonlyArray<IMenuItem>, label: string): IMenuItem {
  const found = items.find(item => item.label === label)
  if (found === undefined) {
    throw new Error(
      `Expected to find menu item "${label}" in [${items
        .map(i => i.label ?? '<separator>')
        .join(', ')}]`
    )
  }
  return found
}

describe('buildCommitContextMenu', () => {
  it('always includes a Copy SHA item with no enabled gating', () => {
    const items = buildCommitContextMenu(makeInputs())
    const copySha = findItem(items, 'Copy SHA')
    assert.strictEqual(copySha.enabled, undefined)
  })

  it('gates Copy Commit URL on the gitHubRepository and non-local commit', () => {
    const commit = makeCommit('b'.repeat(40))
    const githubRepo = new GitHubRepository(
      'demo-repo',
      new Owner('demo-owner', 'https://api.github.com', 1),
      1
    )

    const localOnly = buildCommitContextMenu(
      makeInputs({ commit, isLocalCommit: () => true })
    )
    const localCopyUrl = findItem(localOnly, 'Copy commit URL')
    assert.strictEqual(localCopyUrl.enabled, false)

    const withRepo = buildCommitContextMenu(
      makeInputs({
        commit,
        isLocalCommit: () => false,
        gitHubRepository: githubRepo,
      })
    )
    const remoteCopyUrl = findItem(withRepo, 'Copy commit URL')
    assert.strictEqual(remoteCopyUrl.enabled, true)
  })

  it('gates Reset to commit on canResetToCommits AND onResetToCommit', () => {
    const items = buildCommitContextMenu(
      makeInputs({ canResetToCommits: false })
    )
    const resetItem = findItem(items, 'Reset to commit…')
    assert.strictEqual(resetItem.enabled, false)

    const noCallback = buildCommitContextMenu(
      makeInputs({
        canResetToCommits: true,
        onResetToCommit: undefined,
      })
    )
    assert.strictEqual(
      findItem(noCallback, 'Reset to commit…').enabled,
      false
    )

    let captured: unknown = null
    const withCallback = buildCommitContextMenu(
      makeInputs({
        canResetToCommits: true,
        onResetToCommit: c => {
          captured = c
        },
      })
    )
    const reset = findItem(withCallback, 'Reset to commit…')
    assert.strictEqual(reset.enabled, true)
    if (reset.action !== undefined) {
      reset.action()
    }
    assert.ok(captured !== null)
  })

  it('invokes the reset callback with the commit when the user picks Reset to commit', () => {
    const commit = makeCommit('c'.repeat(40))
    let receivedSha: string | null = null
    const items = buildCommitContextMenu(
      makeInputs({
        commit,
        canResetToCommits: true,
        onResetToCommit: c => {
          receivedSha = c.sha
        },
      })
    )
    const reset = findItem(items, 'Reset to commit…')
    if (reset.action === undefined) {
      throw new Error('Reset to commit item is missing its action')
    }
    reset.action()
    assert.strictEqual(receivedSha, commit.sha)
  })

  it('hides the Reset to commit entry when the row is the most recent commit', () => {
    const items = buildCommitContextMenu(
      makeInputs({ row: 0, canResetToCommits: true })
    )
    const reset = findItem(items, 'Reset to commit…')
    assert.strictEqual(reset.enabled, false)
  })
})
