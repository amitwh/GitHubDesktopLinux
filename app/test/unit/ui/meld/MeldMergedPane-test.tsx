import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { MeldMergedPane } from '../../../../src/ui/meld/MeldMergedPane'
import { IConflictHunk } from '../../../../src/models/meld-merge'

describe('MeldMergedPane', () => {
  /** Helper to make a minimal 4-marker conflict hunk */
  function makeHunk(startLine: number, endLine: number): IConflictHunk {
    return {
      startLine,
      endLine,
      baseContent: 'base content',
      localContent: 'local content',
      remoteContent: 'remote content',
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders the merged content in a textarea', () => {
    const content = 'line one\nline two'
    const { container } = render(
      <MeldMergedPane
        content={content}
        hunks={[]}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={() => undefined}
      />
    )
    const textarea = container.querySelector('textarea[data-testid="merged-textarea"]')
    assert.ok(textarea !== null, 'expected a textarea')
    assert.strictEqual(textarea.value, content)
  })

  it('renders the title "Merged Output"', () => {
    const { container } = render(
      <MeldMergedPane
        content="anything"
        hunks={[]}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={() => undefined}
      />
    )
    const title = container.querySelector('.meld-merged-pane-title')
    assert.strictEqual(title?.textContent, 'Merged Output')
  })

  it('disables the textarea when readOnly is true', () => {
    const { container } = render(
      <MeldMergedPane
        content="readonly content"
        hunks={[]}
        readOnly={true}
        onContentChange={() => undefined}
        onHunkResolved={() => undefined}
      />
    )
    const textarea = container.querySelector(
      'textarea[data-testid="merged-textarea"]'
    ) as HTMLTextAreaElement
    assert.strictEqual(textarea.readOnly, true)
  })

  it('renders one action bar per hunk', () => {
    // 4-marker merged text with 2 conflict blocks
    const merged = [
      'context before',
      '<<<<<<< HEAD',
      'local1',
      '||||||| base',
      'base1',
      '=======',
      'remote1',
      '>>>>>>> br1',
      'middle context',
      '<<<<<<< HEAD',
      'local2',
      '||||||| base',
      'base2',
      '=======',
      'remote2',
      '>>>>>>> br2',
      'context after',
    ].join('\n')

    const hunks = [
      makeHunk(1, 7),
      makeHunk(9, 15),
    ]

    const { container } = render(
      <MeldMergedPane
        content={merged}
        hunks={hunks}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={() => undefined}
      />
    )
    const bars = container.querySelectorAll('.meld-merged-hunk-bar')
    assert.strictEqual(bars.length, 2, 'expected 2 action bars for 2 hunks')
  })

  it('renders three resolution buttons per action bar', () => {
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'local',
      '|||||||',
      'base',
      '=======',
      'remote',
      '>>>>>>> br',
      'end',
    ].join('\n')
    const hunks = [makeHunk(1, 7)]

    const { container } = render(
      <MeldMergedPane
        content={merged}
        hunks={hunks}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={() => undefined}
      />
    )
    const buttons = container.querySelectorAll('.meld-merged-hunk-bar button')
    assert.strictEqual(buttons.length, 3, 'expected 3 buttons per action bar')
  })

  it('action bar buttons are labeled Accept LOCAL, Accept REMOTE, Use BASE', () => {
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'local',
      '|||||||',
      'base',
      '=======',
      'remote',
      '>>>>>>> br',
      'end',
    ].join('\n')
    const hunks = [makeHunk(1, 7)]

    const { container } = render(
      <MeldMergedPane
        content={merged}
        hunks={hunks}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={() => undefined}
      />
    )
    const buttonTexts = Array.from(
      container.querySelectorAll('.meld-merged-hunk-bar button')
    ).map(b => b.textContent)
    assert.deepStrictEqual(buttonTexts, ['Accept LOCAL', 'Accept REMOTE', 'Use BASE'])
  })

  // -------------------------------------------------------------------------
  // Interactions
  // -------------------------------------------------------------------------

  it('calls onHunkResolved(idx, "local") when Accept LOCAL is clicked', () => {
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'local',
      '|||||||',
      'base',
      '=======',
      'remote',
      '>>>>>>> br',
      'end',
    ].join('\n')
    const hunks = [makeHunk(1, 7)]

    let captured: { hunkIndex: number; side: 'base' | 'local' | 'remote' } | null = null
    const { container } = render(
      <MeldMergedPane
        content={merged}
        hunks={hunks}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={(hunkIndex, side) => {
          captured = { hunkIndex, side }
        }}
      />
    )
    fireEvent.click(
      container.querySelector(
        'button[data-testid="resolve-local-0"]'
      ) as HTMLElement
    )
    assert.deepStrictEqual(captured, { hunkIndex: 0, side: 'local' })
  })

  it('calls onHunkResolved(idx, "remote") when Accept REMOTE is clicked', () => {
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'local',
      '|||||||',
      'base',
      '=======',
      'remote',
      '>>>>>>> br',
      'end',
    ].join('\n')
    const hunks = [makeHunk(1, 7)]

    let captured: { hunkIndex: number; side: 'base' | 'local' | 'remote' } | null = null
    const { container } = render(
      <MeldMergedPane
        content={merged}
        hunks={hunks}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={(hunkIndex, side) => {
          captured = { hunkIndex, side }
        }}
      />
    )
    fireEvent.click(
      container.querySelector(
        'button[data-testid="resolve-remote-0"]'
      ) as HTMLElement
    )
    assert.deepStrictEqual(captured, { hunkIndex: 0, side: 'remote' })
  })

  it('calls onHunkResolved(idx, "base") when Use BASE is clicked', () => {
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'local',
      '|||||||',
      'base',
      '=======',
      'remote',
      '>>>>>>> br',
      'end',
    ].join('\n')
    const hunks = [makeHunk(1, 7)]

    let captured: { hunkIndex: number; side: 'base' | 'local' | 'remote' } | null = null
    const { container } = render(
      <MeldMergedPane
        content={merged}
        hunks={hunks}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={(hunkIndex, side) => {
          captured = { hunkIndex, side }
        }}
      />
    )
    fireEvent.click(
      container.querySelector(
        'button[data-testid="resolve-base-0"]'
      ) as HTMLElement
    )
    assert.deepStrictEqual(captured, { hunkIndex: 0, side: 'base' })
  })

  it('debounces onContentChange (does not fire synchronously on change)', () => {
    let callCount = 0
    const { container } = render(
      <MeldMergedPane
        content="original"
        hunks={[]}
        readOnly={false}
        onContentChange={() => {
          callCount++
        }}
        onHunkResolved={() => undefined}
      />
    )
    const textarea = container.querySelector(
      'textarea[data-testid="merged-textarea"]'
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'edited' } })
    // Synchronously, onContentChange should NOT have been called yet (debounce)
    assert.strictEqual(callCount, 0)
  })

  it('uses correct hunk index for second hunk buttons', () => {
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'local1',
      '|||||||',
      'base1',
      '=======',
      'remote1',
      '>>>>>>> br1',
      'middle',
      '<<<<<<< HEAD',
      'local2',
      '|||||||',
      'base2',
      '=======',
      'remote2',
      '>>>>>>> br2',
      'end',
    ].join('\n')
    const hunks = [makeHunk(1, 7), makeHunk(9, 15)]

    let captured: { hunkIndex: number; side: 'base' | 'local' | 'remote' } | null = null
    const { container } = render(
      <MeldMergedPane
        content={merged}
        hunks={hunks}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={(hunkIndex, side) => {
          captured = { hunkIndex, side }
        }}
      />
    )
    // Click Accept LOCAL on the second hunk (index 1)
    fireEvent.click(
      container.querySelector(
        'button[data-testid="resolve-local-1"]'
      ) as HTMLElement
    )
    assert.deepStrictEqual(captured, { hunkIndex: 1, side: 'local' })
  })

  it('does not render action bars when there are no hunks', () => {
    const { container } = render(
      <MeldMergedPane
        content="no conflicts here"
        hunks={[]}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={() => undefined}
      />
    )
    const bars = container.querySelectorAll('.meld-merged-hunk-bar')
    assert.strictEqual(bars.length, 0, 'no action bars when no hunks')
  })

  it('renders a line-number gutter with one number per content line', () => {
    const content = 'one\ntwo\nthree'
    const { container } = render(
      <MeldMergedPane
        content={content}
        hunks={[]}
        readOnly={false}
        onContentChange={() => undefined}
        onHunkResolved={() => undefined}
      />
    )
    const gutter = container.querySelector('pre[data-testid="merged-gutter"]')
    assert.ok(gutter !== null, 'expected a gutter <pre>')
    assert.strictEqual(gutter.textContent, '1\n2\n3')
  })

  it('marks the wrapper with data-readonly when readOnly is true', () => {
    const { container } = render(
      <MeldMergedPane
        content="x"
        hunks={[]}
        readOnly={true}
        onContentChange={() => undefined}
        onHunkResolved={() => undefined}
      />
    )
    const wrapper = container.querySelector('.meld-merged-pane')
    assert.strictEqual(wrapper?.getAttribute('data-readonly'), 'true')
  })
})