import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { fireEvent, render, screen } from '../../../helpers/ui/render'
import { MeldStashView, IMeldStashViewProps } from '../../../../src/ui/meld/MeldStashView'
import { IAllStashEntry } from '../../../../src/lib/git/stash'
import { CommittedFileChange, AppFileStatusKind } from '../../../../src/models/status'

function makeStash(name: string, sha: string, message: string): IAllStashEntry {
  return {
    name,
    stashSha: sha,
    message,
    branchName: null,
  }
}

function makeFile(path: string, kind: AppFileStatusKind): CommittedFileChange {
  return new CommittedFileChange(
    path,
    { kind } as never,
    'stash-sha',
    'parent-sha'
  )
}

describe('MeldStashView', () => {
  const stashes: ReadonlyArray<IAllStashEntry> = [
    makeStash('stash@{0}', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'WIP: tweak a'),
    makeStash('stash@{1}', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'WIP: tweak b'),
  ]
  const filesBySha: Record<string, ReadonlyArray<CommittedFileChange>> = {
    aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: [
      makeFile('src/a.ts', AppFileStatusKind.Modified),
      makeFile('README.md', AppFileStatusKind.New),
    ],
    bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb: [
      makeFile('src/b.ts', AppFileStatusKind.Deleted),
    ],
  }

  const defaultProps: IMeldStashViewProps = {
    onGetStashes: async () => stashes,
    onGetStashFiles: async sha => filesBySha[sha] ?? [],
    onFileSelected: () => undefined,
  }

  it('renders the list of stashes on mount', async () => {
    render(<MeldStashView {...defaultProps} />)
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.ok(screen.getByText('stash@{0}'), 'stash@{0} should render')
    assert.ok(screen.getByText('stash@{1}'), 'stash@{1} should render')
  })

  it('shows a loading state before the stashes are loaded', () => {
    render(
      <MeldStashView
        {...defaultProps}
        onGetStashes={() => new Promise(() => undefined)}
      />
    )
    assert.ok(
      document.querySelector('.meld-stash-loading'),
      'expected loading element to render before fetch resolves'
    )
  })

  it('shows an empty state when the repository has no stashes', async () => {
    render(<MeldStashView {...defaultProps} onGetStashes={async () => []} />)
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.ok(document.querySelector('.meld-stash-empty'))
  })

  it('expands a stash and renders its files when the toggle is clicked', async () => {
    render(<MeldStashView {...defaultProps} />)
    await new Promise(resolve => setTimeout(resolve, 0))

    const toggle = document.querySelector(
      '[data-testid="meld-stash-toggle-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]'
    ) as HTMLButtonElement | null
    assert.ok(toggle, 'expected a toggle button for the first stash')
    fireEvent.click(toggle!)

    // Allow the second async fetch to resolve
    await new Promise(resolve => setTimeout(resolve, 0))

    assert.ok(screen.getByText('src/a.ts'))
    assert.ok(screen.getByText('README.md'))
  })

  it('collapses a stash when its toggle is clicked twice', async () => {
    render(<MeldStashView {...defaultProps} />)
    await new Promise(resolve => setTimeout(resolve, 0))

    const toggle = document.querySelector(
      '[data-testid="meld-stash-toggle-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]'
    ) as HTMLButtonElement | null
    fireEvent.click(toggle!)
    await new Promise(resolve => setTimeout(resolve, 0))
    fireEvent.click(toggle!)
    await new Promise(resolve => setTimeout(resolve, 0))

    // After collapsing, the file list should not be in the DOM
    const row = document.querySelector(
      '[data-testid="meld-stash-file-src/a.ts"]'
    )
    assert.strictEqual(
      row,
      null,
      'expected file rows to disappear after collapsing'
    )
  })

  it('calls onFileSelected when a file row is clicked', async () => {
    let capturedStashSha: string | null = null
    let capturedFile: string | null = null
    render(
      <MeldStashView
        {...defaultProps}
        onFileSelected={(sha, file) => {
          capturedStashSha = sha
          capturedFile = file
        }}
      />
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    fireEvent.click(
      document.querySelector(
        '[data-testid="meld-stash-toggle-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]'
      )!
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    fireEvent.click(
      document.querySelector('[data-testid="meld-stash-file-src/a.ts"] button')!
    )

    assert.strictEqual(capturedStashSha, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    assert.strictEqual(capturedFile, 'src/a.ts')
  })

  it('surfaces fetch errors as a banner', async () => {
    render(
      <MeldStashView
        {...defaultProps}
        onGetStashes={async () => {
          throw new Error('boom')
        }}
      />
    )
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.ok(
      document.querySelector('.meld-error-banner'),
      'expected an error banner to render after fetch failure'
    )
    assert.ok(
      document.querySelector('.meld-error-banner')!.textContent!.includes('boom')
    )
  })

  it('shows an inline error if onGetStashFiles throws', async () => {
    render(
      <MeldStashView
        {...defaultProps}
        onGetStashFiles={async () => {
          throw new Error('files-fetch-failed')
        }}
      />
    )
    await new Promise(resolve => setTimeout(resolve, 0))
    fireEvent.click(
      document.querySelector(
        '[data-testid="meld-stash-toggle-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]'
      )!
    )
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.ok(
      document.querySelector('.meld-stash-files-error'),
      'expected an inline error to render when file fetch fails'
    )
  })

  it('marks the selected file row with data-selected="true"', async () => {
    render(<MeldStashView {...defaultProps} />)
    await new Promise(resolve => setTimeout(resolve, 0))
    fireEvent.click(
      document.querySelector(
        '[data-testid="meld-stash-toggle-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]'
      )!
    )
    await new Promise(resolve => setTimeout(resolve, 0))
    fireEvent.click(
      document.querySelector('[data-testid="meld-stash-file-src/a.ts"] button')!
    )
    const selected = document.querySelector('[data-selected="true"]')
    assert.ok(selected, 'expected a selected row after file click')
    assert.ok(selected!.textContent!.includes('src/a.ts'))
  })
})