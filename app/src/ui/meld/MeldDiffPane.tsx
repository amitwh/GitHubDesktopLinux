import * as React from 'react'
import { IDiff, ITextDiff, DiffType } from '../../models/diff'

export interface IMeldDiffPaneProps {
  readonly filePath: string
  readonly diff: IDiff | null
  readonly loading: boolean
}

/**
 * Render the diff text. For Phase 1a this is raw text rendering; Phase 1b
 * replaces it with editable panes + char-level diff. Falls back to a summary
 * for non-text diffs (image, binary, submodule) since those need specialized
 * renderers that live in `app/src/ui/diff/image-diffs/`.
 */
function renderDiffText(diff: IDiff): string {
  if (diff.kind === DiffType.Text) {
    return (diff as ITextDiff).text
  }
  if (diff.kind === DiffType.LargeText) {
    return (diff as ITextDiff).text
  }
  return `[${diff.kind} diff — not rendered in Phase 1a]`
}

export class MeldDiffPane extends React.Component<IMeldDiffPaneProps, {}> {
  public render() {
    const { filePath, diff, loading } = this.props
    return (
      <div className="meld-diff-pane">
        <div className="meld-diff-pane-header" role="heading" aria-level={2}>
          {filePath}
        </div>
        {loading && (
          <div className="meld-loading" role="status">Loading diff…</div>
        )}
        {!loading && !diff && (
          <div className="meld-empty-state" role="status">No changes to display.</div>
        )}
        {!loading && diff && (
          <div className="meld-diff-pane-side-by-side">
            <pre className="meld-diff-raw">{renderDiffText(diff)}</pre>
          </div>
        )}
      </div>
    )
  }
}
