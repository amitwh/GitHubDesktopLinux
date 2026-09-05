import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { render, fireEvent } from '@testing-library/react'
import {
  MeldRebasePreview,
  IMeldRebasePreviewProps,
  IRebaseCommit,
} from '../../../../src/ui/meld/MeldRebasePreview'
import { IRebaseCommitStats } from '../../../../src/lib/meld/rebasePreview'

function makeCommit(sha: string, summary: string): IRebaseCommit {
  return { sha, summary }
}

const baseProps: IMeldRebasePreviewProps = {
  commits: [
    makeCommit('aaaaaaaa', 'First commit'),
    makeCommit('bbbbbbbb', 'Second commit'),
    makeCommit('cccccccc', 'Third commit'),
  ],
  stats: {
    aaaaaaaa: { filesChanged: 1, insertions: 5, deletions: 2 },
    bbbbbbbb: { filesChanged: 2, insertions: 7, deletions: 0 },
    cccccccc: { filesChanged: 1, insertions: 0, deletions: 3 },
  },
  loading: {},
  onViewDiff: () => undefined,
}

describe('MeldRebasePreview', () => {
  it('renders a row per commit', () => {
    const { container } = render(<MeldRebasePreview {...baseProps} />)
    const rows = container.querySelectorAll('.meld-rebase-preview-row')
    assert.strictEqual(rows.length, 3)
  })

  it('renders the commit summary + short SHA on each row', () => {
    const { container } = render(<MeldRebasePreview {...baseProps} />)
    const txt = container.textContent!
    assert.ok(txt.includes('First commit'))
    assert.ok(txt.includes('aaaaaaa'))
  })

  it('shows aggregate stats for each commit', () => {
    const { container } = render(<MeldRebasePreview {...baseProps} />)
    const txt = container.textContent!
    assert.ok(txt.includes('5 insertions') || txt.includes('+5'))
    assert.ok(txt.includes('2 deletions') || txt.includes('-2'))
  })

  it('shows "no changes" for a commit with zero stats', () => {
    const stats: { [sha: string]: IRebaseCommitStats } = {
      aaaaaaaa: { filesChanged: 0, insertions: 0, deletions: 0 },
    }
    const { container } = render(
      <MeldRebasePreview
        {...baseProps}
        commits={[makeCommit('aaaaaaaa', 'Empty commit')]}
        stats={stats}
      />
    )
    const txt = container.textContent!
    assert.ok(
      txt.toLowerCase().includes('no changes') || txt.includes('0 insertions'),
      'expected empty-commit row to display no-changes summary'
    )
  })

  it('invokes onViewDiff with the commit SHA when "View diff" is clicked', () => {
    let receivedSha: string | null = null
    const { container } = render(
      <MeldRebasePreview
        {...baseProps}
        onViewDiff={sha => {
          receivedSha = sha
        }}
      />
    )
    const buttons = container.querySelectorAll(
      '.meld-rebase-preview-view-diff-button'
    )
    assert.strictEqual(buttons.length, 3)
    fireEvent.click(buttons[1] as HTMLElement)
    assert.strictEqual(receivedSha, 'bbbbbbbb')
  })

  it('renders a disabled "View diff" button for dropped commits', () => {
    const commits: ReadonlyArray<IRebaseCommit> = [
      {
        sha: 'aaaaaaaa',
        summary: 'Picked commit',
      },
      {
        sha: 'bbbbbbbb',
        summary: 'Squashed commit',
      },
    ]
    const { container } = render(
      <MeldRebasePreview
        {...baseProps}
        commits={commits}
        isDropped={sha => sha === 'bbbbbbbb'}
      />
    )
    const buttons = container.querySelectorAll(
      '.meld-rebase-preview-view-diff-button'
    )
    const droppedButton = buttons[1] as HTMLButtonElement
    assert.strictEqual(
      droppedButton.disabled,
      true,
      'expected dropped commit to have disabled button'
    )
  })

  it('shows a loading indicator when stats for a commit are not yet known', () => {
    const { container } = render(
      <MeldRebasePreview {...baseProps} loading={{ bbbbbbbb: true }} />
    )
    const rows = container.querySelectorAll('.meld-rebase-preview-row')
    assert.strictEqual(rows.length, 3)
    const loading = container.querySelectorAll(
      '.meld-rebase-preview-stats-loading'
    )
    assert.ok(loading.length >= 1, 'expected at least one loading indicator')
  })
})
