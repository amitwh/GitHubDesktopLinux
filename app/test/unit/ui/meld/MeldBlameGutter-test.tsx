import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { MeldBlameGutter } from '../../../../src/ui/meld/MeldBlameGutter'
import { IBlameHunk } from '../../../../src/lib/git/blame'

function makeHunk(
  startLine: number,
  sha: string,
  author: string,
  summary: string = `commit ${sha}`
): IBlameHunk {
  return {
    startLine,
    lineCount: 1,
    sha,
    author,
    authorEmail: `${sha}@example.com`,
    timestamp: new Date(0),
    summary,
  }
}

describe('MeldBlameGutter', () => {
  it('renders an empty placeholder for null entries', () => {
    const { container } = render(
      <MeldBlameGutter lines={[null, null]} onOpenCommit={() => undefined} />
    )
    const cells = container.querySelectorAll('.meld-blame-gutter-cell')
    assert.strictEqual(cells.length, 2)
    for (const cell of cells) {
      assert.ok(
        cell.classList.contains('meld-blame-gutter-cell-empty'),
        'expected every null entry to render an empty cell'
      )
    }
  })

  it('renders a button with author and short SHA for non-null entries', () => {
    const lines = [makeHunk(0, 'abc1234567890', 'Alice')]
    const { container } = render(
      <MeldBlameGutter lines={lines} onOpenCommit={() => undefined} />
    )
    const button = container.querySelector(
      '.meld-blame-gutter-button'
    ) as HTMLButtonElement | null
    assert.ok(button !== null, 'expected a button for the non-null entry')
    assert.ok(
      button!.textContent!.includes('Alice'),
      'expected the author to be visible'
    )
    assert.ok(
      button!.textContent!.includes('abc1234'),
      'expected the short SHA (first 7 chars) to be visible'
    )
  })

  it('truncates long author names with an ellipsis', () => {
    const lines = [makeHunk(0, 'aaaaaaa', 'Some Very Long Author Name')]
    const { container } = render(
      <MeldBlameGutter lines={lines} onOpenCommit={() => undefined} />
    )
    const authorEl = container.querySelector('.meld-blame-gutter-author')
    assert.ok(authorEl !== null, 'expected an author span')
    const text = authorEl!.textContent!
    assert.ok(text.endsWith('…'), `expected ellipsis suffix, got "${text}"`)
    assert.ok(text.length <= 10, `expected short display, got ${text.length}`)
  })

  it('sets an aria-label on each non-null cell with the attribution', () => {
    const lines = [makeHunk(0, 'deadbeef0000', 'Bob')]
    const { container } = render(
      <MeldBlameGutter lines={lines} onOpenCommit={() => undefined} />
    )
    const cell = container.querySelector(
      '.meld-blame-gutter-cell'
    ) as HTMLElement | null
    assert.ok(cell !== null)
    const ariaLabel = cell!.getAttribute('aria-label') ?? ''
    assert.ok(
      ariaLabel.startsWith('Blame: Bob, deadbee'),
      `expected aria-label to start with author and short SHA, got: ${ariaLabel}`
    )
  })

  it('surfaces the full attribution (author, SHA, date, summary) to assistive tech', () => {
    const lines = [
      {
        ...makeHunk(0, 'deadbeef0000', 'Bob', 'fix: widget bug'),
        timestamp: new Date(2024, 0, 15, 14, 30), // 2024-01-15 14:30 local
      },
    ]
    const { container } = render(
      <MeldBlameGutter lines={lines} onOpenCommit={() => undefined} />
    )
    const cell = container.querySelector(
      '.meld-blame-gutter-cell'
    ) as HTMLElement | null
    assert.ok(cell !== null)
    const ariaLabel = cell!.getAttribute('aria-label') ?? ''
    assert.ok(ariaLabel.includes('Bob'), 'expected author in aria-label')
    assert.ok(
      ariaLabel.includes('deadbeef0000'),
      'expected full SHA in aria-label'
    )
    assert.ok(ariaLabel.includes('2024-01-15'), 'expected date in aria-label')
    assert.ok(ariaLabel.includes('14:30'), 'expected time in aria-label')
    assert.ok(
      ariaLabel.includes('fix: widget bug'),
      'expected summary in aria-label'
    )
  })

  it('invokes onOpenCommit with the full SHA when a cell is clicked', () => {
    const lines = [makeHunk(0, 'abcdef1234567', 'Carol')]
    let captured: string | null = null
    const { container } = render(
      <MeldBlameGutter
        lines={lines}
        onOpenCommit={sha => {
          captured = sha
        }}
      />
    )
    const button = container.querySelector(
      '.meld-blame-gutter-button'
    ) as HTMLButtonElement | null
    assert.ok(button !== null)
    fireEvent.click(button!)
    assert.strictEqual(captured, 'abcdef1234567')
  })

  it('does not invoke onOpenCommit when an empty (null) cell is "clicked"', () => {
    // The empty cell is a plain `<li>`, not a button. Clicking the list
    // item must not bubble to a commit-open action.
    let calls = 0
    const { container } = render(
      <MeldBlameGutter
        lines={[null]}
        onOpenCommit={() => {
          calls++
        }}
      />
    )
    const emptyCell = container.querySelector(
      '.meld-blame-gutter-cell-empty'
    ) as HTMLElement | null
    assert.ok(emptyCell !== null)
    fireEvent.click(emptyCell!)
    assert.strictEqual(calls, 0)
  })

  it('renders loading cells when loading=true', () => {
    const { container } = render(
      <MeldBlameGutter
        lines={[makeHunk(0, 'aaaaaa', 'A'), makeHunk(1, 'bbbbbb', 'B')]}
        onOpenCommit={() => undefined}
        loading={true}
      />
    )
    const cells = container.querySelectorAll('.meld-blame-gutter-cell')
    for (const cell of cells) {
      assert.ok(
        cell.classList.contains('meld-blame-gutter-cell-loading'),
        'expected every cell to render in loading state'
      )
    }
    // No buttons should be rendered while loading
    assert.strictEqual(
      container.querySelectorAll('.meld-blame-gutter-button').length,
      0
    )
  })

  it('marks the list as an ordered list with a meaningful aria-label', () => {
    const { container } = render(
      <MeldBlameGutter lines={[null]} onOpenCommit={() => undefined} />
    )
    const list = container.querySelector(
      'ol.meld-blame-gutter'
    ) as HTMLElement | null
    assert.ok(list !== null, 'expected an <ol> root')
    assert.strictEqual(
      list!.getAttribute('aria-label'),
      'Git blame per right-side line'
    )
  })

  it('renders one cell per entry, preserving order', () => {
    const lines = [
      makeHunk(0, 'aaaaaa', 'A'),
      null,
      makeHunk(5, 'bbbbbb', 'B'),
      null,
      null,
    ]
    const { container } = render(
      <MeldBlameGutter lines={lines} onOpenCommit={() => undefined} />
    )
    const cells = container.querySelectorAll('.meld-blame-gutter-cell')
    assert.strictEqual(cells.length, 5)
  })
})
