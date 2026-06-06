import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { render, screen } from '../../../helpers/ui/render'
import { MeldDiffPane, IMeldDiffPaneProps } from '../../../../src/ui/meld/MeldDiffPane'
import { IDiff, DiffType, ITextDiff } from '../../../../src/models/diff'

const sampleTextDiff: ITextDiff = {
  kind: DiffType.Text,
  text: '@@ -1,3 +1,3 @@\n line1\n-old\n+new\n line3',
  hunks: [],
  maxLineNumber: 3,
  hasHiddenBidiChars: false,
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

  it('renders the diff content in a side-by-side layout', () => {
    const { container } = render(<MeldDiffPane {...defaultProps} />)
    assert.ok(container.querySelector('.meld-diff-pane-side-by-side'))
  })
})
