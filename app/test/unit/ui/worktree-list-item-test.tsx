import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { WorktreeListItem } from '../../../src/ui/worktrees/worktree-list-item'
import { IMatches } from '../../../src/lib/fuzzy-find'
import { WorktreeEntry } from '../../../src/models/worktree'
import { render, screen } from '../../helpers/ui/render'

const noMatches: IMatches = { title: [], subtitle: [] }

function makeEntry(overrides: Partial<WorktreeEntry>): WorktreeEntry {
  return {
    path: '/path/to/repo',
    head: 'abc1234abc1234abc1234abc1234abc1234abc123',
    branch: 'refs/heads/main',
    isDetached: false,
    type: 'main',
    isLocked: false,
    isPrunable: false,
    ...overrides,
  }
}

describe('WorktreeListItem', () => {
  it('renders a Locked badge when the worktree is locked', () => {
    render(
      <WorktreeListItem
        worktree={makeEntry({
          type: 'linked',
          path: '/path/to/locked-wt',
          isLocked: true,
        })}
        isCurrentWorktree={false}
        matches={noMatches}
      />
    )

    assert.ok(screen.getByText('Locked') !== null)
  })

  it('does not render a Locked badge when the worktree is not locked', () => {
    render(
      <WorktreeListItem
        worktree={makeEntry({
          type: 'linked',
          path: '/path/to/repo',
          isLocked: false,
        })}
        isCurrentWorktree={false}
        matches={noMatches}
      />
    )

    assert.equal(screen.queryByText('Locked'), null)
  })

  it('renders a Stale badge when the worktree directory is missing', () => {
    const missingPath = join(
      mkdtempSync(join(tmpdir(), 'ghd-wt-stale-')),
      'missing-wt'
    )

    render(
      <WorktreeListItem
        worktree={makeEntry({ type: 'linked', path: missingPath })}
        isCurrentWorktree={false}
        matches={noMatches}
      />
    )

    assert.ok(screen.getByText(/Stale/) !== null)
  })

  it('renders the formatted size when sizeBytes is provided', () => {
    render(
      <WorktreeListItem
        worktree={makeEntry({ type: 'linked', path: '/path/to/wt' })}
        isCurrentWorktree={false}
        matches={noMatches}
        sizeBytes={1_500_000}
      />
    )

    assert.ok(screen.getByText(/1\.4 MB/) !== null)
  })

  it('renders the formatted size in bytes for small sizes', () => {
    render(
      <WorktreeListItem
        worktree={makeEntry({ type: 'linked', path: '/path/to/wt' })}
        isCurrentWorktree={false}
        matches={noMatches}
        sizeBytes={512}
      />
    )

    assert.ok(screen.getByText(/512 B/) !== null)
  })

  it('renders an em-dash when sizeBytes is null', () => {
    render(
      <WorktreeListItem
        worktree={makeEntry({ type: 'linked', path: '/path/to/wt' })}
        isCurrentWorktree={false}
        matches={noMatches}
        sizeBytes={null}
      />
    )

    assert.ok(screen.getByText('—') !== null)
  })

  it('does not render a Stale badge when the worktree directory exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghd-wt-present-'))
    try {
      render(
        <WorktreeListItem
          worktree={makeEntry({ type: 'linked', path: dir })}
          isCurrentWorktree={false}
          matches={noMatches}
        />
      )

      assert.equal(screen.queryByText(/Stale/), null)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('renders the size in gigabytes for very large worktrees', () => {
    render(
      <WorktreeListItem
        worktree={makeEntry({ type: 'linked', path: '/path/to/wt' })}
        isCurrentWorktree={false}
        matches={noMatches}
        sizeBytes={5 * 1024 ** 3}
      />
    )

    assert.ok(screen.getByText(/5\.0 GB/) !== null)
  })

  // Used in the helper above; silence the unused-import lint warning
  // for writeFileSync/mkdirSync (kept for parity with future tests).
  void writeFileSync
  void mkdirSync
})
