import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { render, screen, fireEvent } from '../../../helpers/ui/render'
import { MeldDiffPane, IMeldDiffPaneProps } from '../../../../src/ui/meld/MeldDiffPane'
import { IDiff, DiffType, ITextDiff } from '../../../../src/models/diff'
import { IMeldEditState } from '../../../../src/models/meld-edit'

const sampleTextDiff: ITextDiff = {
  kind: DiffType.Text,
  text: '@@ -1,3 +1,3 @@\n line1\n-old\n+new\n line3',
  hunks: [],
  maxLineNumber: 3,
  hasHiddenBidiChars: false,
}

const sampleEditState: IMeldEditState = {
  leftContent: 'line1\nold\nline3',
  rightContent: 'line1\nnew\nline3',
  leftOriginal: 'line1\nold\nline3',
  rightOriginal: 'line1\nnew\nline3',
  hasChanges: true,
}

describe('MeldDiffPane', () => {
  const defaultProps: IMeldDiffPaneProps = {
    filePath: 'src/example.ts',
    diff: sampleTextDiff as IDiff,
    loading: false,
  }

  it('renders the file path', () => {
    render(<MeldDiffPane {...defaultProps} />)
    assert.ok(screen.getByText('src/example.ts'))
  })

  it('shows loading state when loading is true', () => {
    render(<MeldDiffPane {...defaultProps} loading={true} diff={null} />)
    assert.ok(screen.getByText(/loading/i))
  })

  it('shows empty state when diff is null and not loading', () => {
    render(<MeldDiffPane {...defaultProps} diff={null} />)
    assert.ok(screen.getByText(/no changes/i))
  })

  it('renders the diff content in a side-by-side layout (raw mode)', () => {
    const { container } = render(<MeldDiffPane {...defaultProps} />)
    assert.ok(container.querySelector('.meld-diff-pane-side-by-side'))
    // No edit-state was passed, so we should be in raw mode.
    const wrapper = container.querySelector('.meld-diff-pane')!
    assert.strictEqual(wrapper.getAttribute('data-mode'), 'raw')
  })

  it('renders two editor panes when editState is provided', () => {
    const { container } = render(
      <MeldDiffPane {...defaultProps} editState={sampleEditState} />
    )
    assert.ok(container.querySelector('[data-testid="editor-left"]'))
    assert.ok(container.querySelector('[data-testid="editor-right"]'))
    const wrapper = container.querySelector('.meld-diff-pane')!
    assert.strictEqual(wrapper.getAttribute('data-mode'), 'editable')
  })

  it('renders the char-diff overlay when editState is provided', () => {
    const { container } = render(
      <MeldDiffPane {...defaultProps} editState={sampleEditState} />
    )
    const overlay = container.querySelector('.meld-diff-pane-overlay')
    assert.ok(overlay !== null, 'expected a char-diff overlay')
  })

  it('calls onEditChange when the right editor value changes', () => {
    let lastValue: string | null = null
    const { container } = render(
      <MeldDiffPane
        {...defaultProps}
        editState={sampleEditState}
        onEditChange={(_s, v) => {
          lastValue = v
        }}
      />
    )
    const textarea = container.querySelector(
      'textarea[data-testid="editor-right"]'
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'changed' } })
    // Debounced — but on Save it flushes. Click save and assert.
    fireEvent.click(
      container.querySelector('button[data-testid="save-right"]') as HTMLElement
    )
    assert.strictEqual(lastValue, 'changed')
  })

  it('calls onCopyHunkRight when a hunk right-arrow is clicked', () => {
    const multiHunk: ITextDiff = {
      kind: DiffType.Text,
      text:
        '@@ -1,1 +1,1 @@\n-old1\n+new1\n' +
        '@@ -10,1 +10,1 @@\n-old2\n+new2',
      hunks: [],
      maxLineNumber: 10,
      hasHiddenBidiChars: false,
    }
    let captured: number | null = null
    const { container } = render(
      <MeldDiffPane
        {...defaultProps}
        diff={multiHunk as IDiff}
        editState={sampleEditState}
        onCopyHunkRight={i => {
          captured = i
        }}
      />
    )
    const rightArrows = container.querySelectorAll(
      'button[aria-label="Copy to right"]'
    )
    assert.ok(rightArrows.length >= 2, 'expected at least 2 hunk copy buttons')
    fireEvent.click(rightArrows[1] as HTMLElement)
    assert.strictEqual(captured, 1)
  })

  it('does not render hunk copy buttons for a single-hunk diff', () => {
    const { container } = render(
      <MeldDiffPane {...defaultProps} editState={sampleEditState} />
    )
    const buttons = container.querySelectorAll('button[aria-label="Copy to right"]')
    void buttons // unused, but kept for future per-hunk assertions
    // No hunk buttons row should render when there is only one hunk.
    const hunkRows = container.querySelectorAll('.meld-diff-pane-hunk-row')
    assert.strictEqual(hunkRows.length, 0, 'expected no hunk copy rows')
  })
})
