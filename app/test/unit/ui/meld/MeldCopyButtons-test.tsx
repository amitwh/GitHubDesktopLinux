import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { MeldCopyButtons } from '../../../../src/ui/meld/MeldCopyButtons'

describe('MeldCopyButtons', () => {
  it('renders two arrow buttons with the correct aria labels', () => {
    const { container } = render(
      <MeldCopyButtons
        hunkIndex={0}
        onCopyLeft={() => undefined}
        onCopyRight={() => undefined}
      />
    )
    const left = container.querySelector('button[aria-label="Copy to left"]')
    const right = container.querySelector('button[aria-label="Copy to right"]')
    assert.ok(left !== null, 'expected a Copy to left button')
    assert.ok(right !== null, 'expected a Copy to right button')
  })

  it('calls onCopyLeft with the hunk index when the left arrow is clicked', () => {
    let captured: number | null = null
    const { container } = render(
      <MeldCopyButtons
        hunkIndex={2}
        onCopyLeft={i => {
          captured = i
        }}
        onCopyRight={() => undefined}
      />
    )
    const left = container.querySelector(
      'button[aria-label="Copy to left"]'
    ) as HTMLButtonElement
    fireEvent.click(left)
    assert.strictEqual(captured, 2)
  })

  it('calls onCopyRight with the hunk index when the right arrow is clicked', () => {
    let captured: number | null = null
    const { container } = render(
      <MeldCopyButtons
        hunkIndex={5}
        onCopyLeft={() => undefined}
        onCopyRight={i => {
          captured = i
        }}
      />
    )
    const right = container.querySelector(
      'button[aria-label="Copy to right"]'
    ) as HTMLButtonElement
    fireEvent.click(right)
    assert.strictEqual(captured, 5)
  })

  it('uses an aria-label that includes the hunk label when provided', () => {
    const { container } = render(
      <MeldCopyButtons
        hunkIndex={0}
        onCopyLeft={() => undefined}
        onCopyRight={() => undefined}
        label="@@ -1,3 +1,3 @@"
      />
    )
    const group = container.querySelector('[role="group"]')!
    assert.ok(
      group.getAttribute('aria-label')!.includes('@@ -1,3 +1,3 @@'),
      'expected aria-label to include the hunk header'
    )
  })

  it('falls back to a numeric hunk label when label is null', () => {
    const { container } = render(
      <MeldCopyButtons
        hunkIndex={2}
        onCopyLeft={() => undefined}
        onCopyRight={() => undefined}
        label={null}
      />
    )
    const group = container.querySelector('[role="group"]')!
    assert.strictEqual(group.getAttribute('aria-label'), 'Hunk 3')
  })
})
