import * as React from 'react'
import { IConflictHunk } from '../../models/meld-merge'

export interface IMeldMergedPaneProps {
  readonly content: string
  readonly hunks: ReadonlyArray<IConflictHunk>
  readonly readOnly: boolean
  readonly onContentChange: (content: string) => void
  readonly onHunkResolved: (
    hunkIndex: number,
    side: 'base' | 'local' | 'remote',
  ) => void
}

/**
 * Editable MERGED-output pane for Phase 1c three-way merge.
 *
 * Renders the merged file content in a single `<textarea>` with a
 * line-number gutter. Between context regions, a per-hunk action bar
 * is rendered with three resolution buttons:
 *   - "Accept LOCAL"  → calls onHunkResolved(idx, 'local')
 *   - "Accept REMOTE" → calls onHunkResolved(idx, 'remote')
 *   - "Use BASE"      → calls onHunkResolved(idx, 'base')
 *
 * The component uses `parseConflictMarkers` to identify context vs.
 * conflict regions in the MERGED text. Hunks are in the same order as
 * the `hunks` prop array.
 */
export class MeldMergedPane extends React.Component<IMeldMergedPaneProps> {
  private static readonly DebounceMs = 200

  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private draft: string

  public constructor(props: IMeldMergedPaneProps) {
    super(props)
    this.draft = props.content
  }

  public componentDidUpdate(prevProps: IMeldMergedPaneProps) {
    if (prevProps.content !== this.props.content) {
      this.draft = this.props.content
    }
  }

  public componentWillUnmount() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
    }
  }

  private onTextareaChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    this.draft = e.target.value
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.props.onContentChange(this.draft)
    }, MeldMergedPane.DebounceMs)
  }

  private onResolveClick = (
    hunkIndex: number,
    side: 'base' | 'local' | 'remote',
  ) => {
    this.props.onHunkResolved(hunkIndex, side)
  }

  public render() {
    const { content, hunks, readOnly } = this.props

    const lineCount = Math.max(1, this.draft.split('\n').length)
    const lineNumbers = Array.from(
      { length: lineCount },
      (_, i) => i + 1,
    ).join('\n')

    return (
      <div
        className="meld-merged-pane"
        data-readonly={readOnly}
      >
        <div className="meld-merged-pane-header" role="heading" aria-level={3}>
          <span className="meld-merged-pane-title">Merged Output</span>
        </div>
        <div className="meld-merged-pane-body">
          <pre
            className="meld-merged-gutter"
            aria-hidden="true"
            data-testid="merged-gutter"
          >
            {lineNumbers}
          </pre>
          <textarea
            className="meld-merged-textarea"
            value={this.draft}
            readOnly={readOnly}
            onChange={this.onTextareaChanged}
            spellCheck={false}
            aria-label="Merged output editor"
            data-testid="merged-textarea"
          />
        </div>
        {hunks.map((hunk, hunkIndex) => (
          <HunkActionBar
            key={hunkIndex}
            hunkIndex={hunkIndex}
            onResolveClick={this.onResolveClick}
          />
        ))}
      </div>
    )
  }
}

/**
 * A single per-hunk action bar rendered below the main textarea
 * (as a sibling in the scrollable container).
 */
function HunkActionBar({
  hunkIndex,
  onResolveClick,
}: {
  hunkIndex: number
  onResolveClick: (hunkIndex: number, side: 'base' | 'local' | 'remote') => void
}) {
  return (
    <div
      className="meld-merged-hunk-bar"
      role="group"
      aria-label={`Conflict ${hunkIndex + 1} resolution actions`}
    >
      <button
        type="button"
        onClick={() => onResolveClick(hunkIndex, 'local')}
        data-testid={`resolve-local-${hunkIndex}`}
        aria-label="Accept LOCAL version of this conflict"
      >
        Accept LOCAL
      </button>
      <button
        type="button"
        onClick={() => onResolveClick(hunkIndex, 'remote')}
        data-testid={`resolve-remote-${hunkIndex}`}
        aria-label="Accept REMOTE version of this conflict"
      >
        Accept REMOTE
      </button>
      <button
        type="button"
        onClick={() => onResolveClick(hunkIndex, 'base')}
        data-testid={`resolve-base-${hunkIndex}`}
        aria-label="Use BASE (common ancestor) version of this conflict"
      >
        Use BASE
      </button>
    </div>
  )
}