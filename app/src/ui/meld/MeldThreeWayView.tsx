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
function Pane({
  side,
  title,
  lines,
  hunks,
  activeHunk,
  onHunkClicked,
}: {
  side: 'base' | 'local' | 'remote'
  title: string
  lines: ReadonlyArray<string>
  hunks: ReadonlyArray<IDetectedHunk>
  activeHunk: IConflictHunk | null
  onHunkClicked?: (hunk: IConflictHunk) => void
}) {
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
    if (activeHunk === null) return false
    // activeHunk.startLine / endLine are 0-indexed
    return (
      hunk.baseStart <= activeHunk.endLine &&
      hunk.baseEnd >= activeHunk.startLine
    )
  }

  const handleLineClick = (hunk: IDetectedHunk) => {
    if (onHunkClicked) {
      onHunkClicked({
        baseContent: hunk.baseContent,
        localContent: hunk.localContent,
        remoteContent: hunk.remoteContent,
        startLine: hunk.baseStart,
        endLine: hunk.baseEnd,
      })
    }
  }

  // Build per-line spans with hunk decoration.
  // Every span gets a trailing \n except the absolute last line of the file.
  const lineSpans: React.ReactNode[] = []
  let lineIdx = 0

  for (const hunk of hunks) {
    // Lines before this hunk (not in a hunk)
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

    // Lines within this hunk
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
          className={active ? 'meld-hunk-span-active' : 'meld-hunk-span'}
          onClick={() => handleLineClick(hunk)}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleLineClick(hunk)
            }
          }}
          aria-label={`Hunk at line ${absoluteLine + 1}`}
        >
          {hunkLines[j]}
          {!isLast ? '\n' : ''}
        </span>
      )
      lineIdx++
    }
  }

  // Remaining lines after last hunk
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