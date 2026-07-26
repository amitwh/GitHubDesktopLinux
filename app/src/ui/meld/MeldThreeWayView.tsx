import * as React from 'react'
import { IConflictHunk } from '../../models/meld-merge'

export interface IMeldThreeWayViewProps {
  readonly baseContent: string
  readonly localContent: string
  readonly remoteContent: string
  readonly activeHunk: IConflictHunk | null
  readonly onHunkClicked?: (hunk: IConflictHunk) => void
}

/**
 * A detected hunk region computed from line-level differences between
 * BASE/LOCAL and BASE/REMOTE. Unlike IConflictHunk (which is relative to
 * the MERGED file), this internal type is relative to the BASE pane.
 */
interface IDetectedHunk {
  /** 0-based start line index in the BASE pane */
  readonly baseStart: number
  /** Inclusive 0-based end line index in the BASE pane */
  readonly baseEnd: number
  /** Content lines from BASE */
  readonly baseContent: string
  /** Content lines from LOCAL (same length as baseContent) */
  readonly localContent: string
  /** Content lines from REMOTE (same length as baseContent) */
  readonly remoteContent: string
}

/**
 * Compute diff hunks by walking the three line arrays in parallel.
 * A line is "in a hunk" when it differs between base↔local or base↔remote.
 * Consecutive in-hunk lines are grouped into one IDetectedHunk per side.
 */
function computeHunks(
  baseLines: ReadonlyArray<string>,
  localLines: ReadonlyArray<string>,
  remoteLines: ReadonlyArray<string>
): ReadonlyArray<IDetectedHunk> {
  const hunks: IDetectedHunk[] = []
  let i = 0

  while (i < baseLines.length) {
    const baseLine = baseLines[i]
    const localLine = localLines[i] ?? ''
    const remoteLine = remoteLines[i] ?? ''

    const differs = baseLine !== localLine || baseLine !== remoteLine

    if (differs) {
      // Collect the full run of consecutive differing lines
      const runStart = i
      let runEnd = runStart
      while (
        runEnd < baseLines.length &&
        (baseLines[runEnd] !== localLines[runEnd] ||
          baseLines[runEnd] !== remoteLines[runEnd])
      ) {
        runEnd++
      }
      // runEnd is now one past the last differing line

      const runBaseLines = baseLines.slice(runStart, runEnd)
      const runLocalLines = localLines.slice(runStart, runEnd)
      const runRemoteLines = remoteLines.slice(runStart, runEnd)

      hunks.push({
        baseStart: runStart,
        baseEnd: runEnd - 1, // inclusive
        baseContent: runBaseLines.join('\n'),
        localContent: runLocalLines.join('\n'),
        remoteContent: runRemoteLines.join('\n'),
      })

      i = runEnd
    } else {
      i++
    }
  }

  return hunks
}

/**
 * Render a single pane with line numbers and per-line hunk spans.
 * Each line is wrapped in a <span> that carries data-line and
 * optionally data-active="true" and an aria-label for accessibility.
 */
class Pane extends React.Component<
  {
    readonly side: 'base' | 'local' | 'remote'
    readonly title: string
    readonly lines: ReadonlyArray<string>
    readonly hunks: ReadonlyArray<IDetectedHunk>
    readonly activeHunk: IConflictHunk | null
    readonly onHunkClicked?: (hunk: IConflictHunk) => void
  },
  {}
> {
  private handleLineClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    const { onHunkClicked, hunks } = this.props
    if (onHunkClicked === undefined) {
      return
    }
    const startStr = event.currentTarget.getAttribute('data-hunk-start-line')
    if (startStr === null) {
      return
    }
    const startLine = Number(startStr)
    if (Number.isNaN(startLine)) {
      return
    }
    const hunk = hunks.find(h => h.baseStart === startLine)
    if (hunk === undefined) {
      return
    }
    onHunkClicked({
      baseContent: hunk.baseContent,
      localContent: hunk.localContent,
      remoteContent: hunk.remoteContent,
      startLine: hunk.baseStart,
      endLine: hunk.baseEnd,
    })
  }

  private handleSpanKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      // Trigger a synthetic click event with the same target.
      const target = event.currentTarget
      this.handleLineClick({
        currentTarget: target,
      } as unknown as React.MouseEvent<HTMLSpanElement>)
    }
  }

  public render() {
    const { side, title, lines, hunks, activeHunk } = this.props

    const lineNumbers = lines.map((_, idx) => idx + 1)
    const gutterText = lineNumbers.join('\n')

    const getContent = (hunk: IDetectedHunk): string => {
      return side === 'base'
        ? hunk.baseContent
        : side === 'local'
          ? hunk.localContent
          : hunk.remoteContent
    }

    const isActive = (hunk: IDetectedHunk): boolean => {
      if (activeHunk === null) {
        return false
      }
      return (
        hunk.baseStart <= activeHunk.endLine &&
        hunk.baseEnd >= activeHunk.startLine
      )
    }

    // Build per-line spans with hunk decoration.
    const lineSpans: React.ReactNode[] = []
    let lineIdx = 0

    for (const hunk of hunks) {
      while (lineIdx < hunk.baseStart) {
        const isLast = lineIdx === lines.length - 1
        lineSpans.push(
          <span key={`line-${lineIdx}`} data-line={lineIdx}>
            {lines[lineIdx]}
            {!isLast ? '\n' : ''}
          </span>
        )
        lineIdx++
      }

      const hunkContent = getContent(hunk)
      const hunkLines = hunkContent.split('\n')
      const active = isActive(hunk)
      for (let j = 0; j < hunkLines.length; j++) {
        const absoluteLine = hunk.baseStart + j
        const isLast = lineIdx === lines.length - 1
        lineSpans.push(
          <span
            key={`hunk-line-${absoluteLine}`}
            data-line={absoluteLine}
            data-active={active ? 'true' : undefined}
            data-hunk-start={j === 0 ? 'true' : undefined}
            data-hunk-start-line={j === 0 ? hunk.baseStart : undefined}
            className={active ? 'meld-hunk-span-active' : 'meld-hunk-span'}
            onClick={this.handleLineClick}
            role="button"
            tabIndex={0}
            onKeyDown={this.handleSpanKeyDown}
            aria-label={`Hunk at line ${absoluteLine + 1}`}
          >
            {hunkLines[j]}
            {!isLast ? '\n' : ''}
          </span>
        )
        lineIdx++
      }
    }

    while (lineIdx < lines.length) {
      const isLast = lineIdx === lines.length - 1
      lineSpans.push(
        <span key={`line-${lineIdx}`} data-line={lineIdx}>
          {lines[lineIdx]}
          {!isLast ? '\n' : ''}
        </span>
      )
      lineIdx++
    }

    return (
      <div className="meld-three-way-pane" data-side={side}>
        <div className="meld-three-way-pane-header" role="heading" aria-level={3}>
          {title}
        </div>
        <div className="meld-three-way-pane-body">
          <pre
            className="meld-three-way-gutter"
            aria-hidden="true"
            data-testid={`gutter-${side}`}
          >
            {gutterText}
          </pre>
          <div className="meld-three-way-content">
            <pre className="meld-three-way-pre">{lineSpans}</pre>
          </div>
        </div>
      </div>
    )
  }
}

export class MeldThreeWayView extends React.Component<IMeldThreeWayViewProps, {}> {
  public render() {
    const { baseContent, localContent, remoteContent, activeHunk, onHunkClicked } =
      this.props

    const baseLines = baseContent.split('\n')
    const localLines = localContent.split('\n')
    const remoteLines = remoteContent.split('\n')

    const hunks = computeHunks(baseLines, localLines, remoteLines)

    return (
      <div className="meld-three-way-view">
        <div className="meld-three-way-panes">
          <Pane
            side="base"
            title="BASE"
            lines={baseLines}
            hunks={hunks}
            activeHunk={activeHunk}
            onHunkClicked={onHunkClicked}
          />
          <Pane
            side="local"
            title="LOCAL"
            lines={localLines}
            hunks={hunks}
            activeHunk={activeHunk}
            onHunkClicked={onHunkClicked}
          />
          <Pane
            side="remote"
            title="REMOTE"
            lines={remoteLines}
            hunks={hunks}
            activeHunk={activeHunk}
            onHunkClicked={onHunkClicked}
          />
        </div>
      </div>
    )
  }
}