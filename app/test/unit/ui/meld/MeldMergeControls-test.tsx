import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { fireEvent, render, screen } from '../../../helpers/ui/render'
import { MeldMergeControls, IMeldMergeControlsProps } from '../../../../src/ui/meld/MeldMergeControls'

describe('MeldMergeControls', () => {
  const defaultProps: IMeldMergeControlsProps = {
    hasUnresolvedConflicts: true,
    onAutoMerge: () => {},
    onMarkResolved: () => {},
  }

  it('renders both action buttons', () => {
    render(<MeldMergeControls {...defaultProps} />)
    assert.ok(screen.getByTestId('meld-merge-controls-auto-merge'))
    assert.ok(screen.getByTestId('meld-merge-controls-mark-resolved'))
  })

  it('calls onAutoMerge when Auto-merge button is clicked', () => {
    let called = false
    render(
      <MeldMergeControls
        {...defaultProps}
        onAutoMerge={() => {
          called = true
        }}
      />
    )
    fireEvent.click(screen.getByTestId('meld-merge-controls-auto-merge'))
    assert.strictEqual(called, true)
  })

  it('calls onMarkResolved when Mark as resolved button is clicked', () => {
    let called = false
    render(
      <MeldMergeControls
        {...defaultProps}
        hasUnresolvedConflicts={false}
        onMarkResolved={() => {
          called = true
        }}
      />
    )
    fireEvent.click(screen.getByTestId('meld-merge-controls-mark-resolved'))
    assert.strictEqual(called, true)
  })

  it('disables Mark as resolved when hasUnresolvedConflicts is true', () => {
    render(<MeldMergeControls {...defaultProps} hasUnresolvedConflicts={true} />)
    const button = screen.getByTestId('meld-merge-controls-mark-resolved') as HTMLButtonElement
    assert.strictEqual(button.disabled, true)
  })

  it('enables Mark as resolved when hasUnresolvedConflicts is false', () => {
    render(<MeldMergeControls {...defaultProps} hasUnresolvedConflicts={false} />)
    const button = screen.getByTestId('meld-merge-controls-mark-resolved') as HTMLButtonElement
    assert.strictEqual(button.disabled, false)
  })
})
