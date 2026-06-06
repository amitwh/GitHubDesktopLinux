import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { render, screen, fireEvent } from '../../../helpers/ui/render'
import {
  MeldThreeWayView,
  IMeldThreeWayViewProps,
} from '../../../../src/ui/meld/MeldThreeWayView'
import { IConflictHunk } from '../../../../src/models/meld-merge'

const BASE = 'line1\nline2\nline3\nline4\nline5\nline6'
const LOCAL = 'line1\nlineA\nline3\nline4\nline5\nline6'
const REMOTE = 'line1\nline2\nline3\nlineB\nline5\nline6'

describe('MeldThreeWayView', () => {
  const defaultProps: IMeldThreeWayViewProps = {
    baseContent: BASE,
    localContent: LOCAL,
    remoteContent: REMOTE,
    activeHunk: null,
    onHunkClicked: undefined,
  }

  it('renders the BASE / LOCAL / REMOTE pane headers', () => {
    render(<MeldThreeWayView {...defaultProps} />)
    assert.ok(screen.getByText('BASE'))
    assert.ok(screen.getByText('LOCAL'))
    assert.ok(screen.getByText('REMOTE'))
  })

  it('renders the three contents in separate <pre> panes', () => {
    const { container } = render(<MeldThreeWayView {...defaultProps} />)
    const panes = container.querySelectorAll('.meld-three-way-pane')
    assert.strictEqual(panes.length, 3)
  })

  it('renders the base content in the BASE pane', () => {
    const { container } = render(<MeldThreeWayView {...defaultProps} />)
    const basePane = container.querySelector('.meld-three-way-pane[data-side="base"]')
    assert.ok(basePane !== null, 'expected BASE pane')
    const pre = basePane!.querySelector('.meld-three-way-pre')
    assert.ok(pre !== null, 'expected .meld-three-way-pre in BASE pane')
    assert.strictEqual(pre!.textContent, BASE)
  })

  it('renders the local content in the LOCAL pane', () => {
    const { container } = render(<MeldThreeWayView {...defaultProps} />)
    const localPane = container.querySelector('.meld-three-way-pane[data-side="local"]')
    assert.ok(localPane !== null, 'expected LOCAL pane')
    const pre = localPane!.querySelector('.meld-three-way-pre')
    assert.ok(pre !== null, 'expected .meld-three-way-pre in LOCAL pane')
    assert.strictEqual(pre!.textContent, LOCAL)
  })

  it('renders the remote content in the REMOTE pane', () => {
    const { container } = render(<MeldThreeWayView {...defaultProps} />)
    const remotePane = container.querySelector('.meld-three-way-pane[data-side="remote"]')
    assert.ok(remotePane !== null, 'expected REMOTE pane')
    const pre = remotePane!.querySelector('.meld-three-way-pre')
    assert.ok(pre !== null, 'expected .meld-three-way-pre in REMOTE pane')
    assert.strictEqual(pre!.textContent, REMOTE)
  })

  it('highlights the active hunk range with data-active="true"', () => {
    const activeHunk: IConflictHunk = {
      baseContent: 'line4',
      localContent: 'line4',
      remoteContent: 'lineB',
      startLine: 3, // 0-indexed: line4 is at index 3
      endLine: 4,   // inclusive, line4-end (1-indexed: line 4)
    }
    const { container } = render(
      <MeldThreeWayView {...defaultProps} activeHunk={activeHunk} />
    )
    // The active line spans should have data-active="true"
    const activeSpans = container.querySelectorAll('[data-active="true"]')
    assert.ok(
      activeSpans.length >= 1,
      `expected at least 1 active span, got ${activeSpans.length}`
    )
  })

  it('calls onHunkClicked when a hunk row is clicked', () => {
    let capturedHunk: IConflictHunk | null = null
    const { container } = render(
      <MeldThreeWayView
        {...defaultProps}
        onHunkClicked={hunk => {
          capturedHunk = hunk
        }}
      />
    )
    // Click the line-4 row in any pane (line numbers are 0-indexed in data)
    // Line 4 (0-indexed = 3) differs in REMOTE (lineB vs line4)
    const line4Rows = container.querySelectorAll('[data-line="3"]')
    assert.ok(line4Rows.length > 0, 'expected at least one row at line index 3')
    fireEvent.click(line4Rows[0])
    assert.ok(capturedHunk !== null, 'expected onHunkClicked to be called')
    // The hunk should contain line4 content
    assert.ok(
      capturedHunk!.baseContent.includes('line4') ||
        capturedHunk!.localContent.includes('line4') ||
        capturedHunk!.remoteContent.includes('line4'),
      `expected captured hunk to involve line4, got ${JSON.stringify(capturedHunk)}`
    )
  })

  it('renders line numbers in a gutter', () => {
    const { container } = render(<MeldThreeWayView {...defaultProps} />)
    const gutters = container.querySelectorAll('.meld-three-way-gutter')
    assert.strictEqual(gutters.length, 3)
    // Base content has 6 lines, so gutter should show "1\n2\n3\n4\n5\n6"
    const baseGutter = gutters[0]
    assert.ok(
      baseGutter!.textContent!.includes('1'),
      'expected gutter to show line number 1'
    )
    assert.ok(
      baseGutter!.textContent!.includes('6'),
      'expected gutter to show line number 6'
    )
  })

  it('does not crash when activeHunk references a line range outside content', () => {
    const outOfBoundsHunk: IConflictHunk = {
      baseContent: '',
      localContent: '',
      remoteContent: '',
      startLine: 999,
      endLine: 1000,
    }
    // Should not throw
    const { container } = render(
      <MeldThreeWayView {...defaultProps} activeHunk={outOfBoundsHunk} />
    )
    assert.ok(container.querySelector('.meld-three-way-pane') !== null)
  })

  it('renders hunks computed from baseContent differences', () => {
    const { container } = render(<MeldThreeWayView {...defaultProps} />)
    // Line 2 (0-indexed = 1) differs between base("line2") and local("lineA")
    // Line 4 (0-indexed = 3) differs between base("line4") and remote("lineB")
    // Each differing line should be wrapped in a clickable hunk span
    const hunkSpans = container.querySelectorAll('.meld-hunk-span')
    // We expect at least 2 hunk spans (one for local diff, one for remote diff)
    assert.ok(
      hunkSpans.length >= 2,
      `expected at least 2 hunk spans, got ${hunkSpans.length}`
    )
  })
})