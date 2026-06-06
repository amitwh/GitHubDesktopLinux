import * as React from 'react'
import { IDiff, ITextDiff, ILargeTextDiff, DiffType } from '../../models/diff'
import { IMeldEditState } from '../../models/meld-edit'
import { MeldEditorPane } from './MeldEditorPane'
import { MeldCharDiff } from './MeldCharDiff'
import { MeldCopyButtons } from './MeldCopyButtons'
import { computeCharDiff, ICharDiffPart } from '../../lib/meld/diffOperations'

export interface IMeldDiffPaneProps {
  readonly filePath: string
  readonly diff: IDiff | null
  readonly loading: boolean

  /**
   * Optional Phase 1b editor state. When provided, the pane renders
   * two `MeldEditorPane`s side-by-side with a `MeldCharDiff` overlay
   * and per-hunk `MeldCopyButtons`. When omitted, the pane falls
   * back to the 1a raw-text rendering (preserves backward compat for
   * non-text diffs and tests that haven't migrated yet).
   */
  readonly editState?: IMeldEditState | null
  readonly readOnly?: boolean
  readonly onEditChange?: (side: 'left' | 'right', value: string) => void
  readonly onEditSave?: (side: 'left' | 'right') => void
  readonly onEditDiscard?: (side: 'left' | 'right') => void
  readonly onCopyHunkLeft?: (hunkIndex: number) => void
  readonly onCopyHunkRight?: (hunkIndex: number) => void
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
    return (diff as ILargeTextDiff).text
  }
  return `[${diff.kind} diff — not rendered in Phase 1a]`
}

/**
 * Derive the side-by-side split from the raw diff text. For 1b we use
 * a simple model: each hunk is one block, with a `Copy to right` /
 * `Copy to left` set of buttons between the two panes. The char-level
 * diff overlay is computed per-hunk from the lines that differ.
 */
function splitHunksFromText(text: string): ReadonlyArray<string> {
  if (text === '') return []
  // Unified diff text starts each hunk with a `@@` line; split on that
  // and re-attach the header so each block is self-contained.
  const lines = text.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  for (const line of lines) {
    if (line.startsWith('@@') && current.length > 0) {
      blocks.push(current.join('\n'))
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) {
    blocks.push(current.join('\n'))
  }
  return blocks.length > 0 ? blocks : [text]
}

export class MeldDiffPane extends React.Component<IMeldDiffPaneProps, {}> {
  public render() {
    const {
      filePath,
      diff,
      loading,
      editState,
      readOnly = false,
      onEditChange,
      onEditSave,
      onEditDiscard,
      onCopyHunkLeft,
      onCopyHunkRight,
    } = this.props

    const useEditors = editState !== undefined && editState !== null

    return (
      <div className="meld-diff-pane" data-mode={useEditors ? 'editable' : 'raw'}>
        <div className="meld-diff-pane-header" role="heading" aria-level={2}>
          {filePath}
        </div>
        {loading && (
          <div className="meld-loading" role="status">Loading diff…</div>
        )}
        {!loading && !diff && !editState && (
          <div className="meld-empty-state" role="status">No changes to display.</div>
        )}
        {!loading && diff && !useEditors && (
          <div className="meld-diff-pane-side-by-side">
            <pre className="meld-diff-raw">{renderDiffText(diff)}</pre>
          </div>
        )}
        {!loading && useEditors && editState && this.renderEditors(editState, {
          readOnly,
          onEditChange,
          onEditSave,
          onEditDiscard,
          onCopyHunkLeft,
          onCopyHunkRight,
        })}
      </div>
    )
  }

  private renderEditors(
    state: IMeldEditState,
    handlers: {
      readOnly: boolean
      onEditChange?: (side: 'left' | 'right', value: string) => void
      onEditSave?: (side: 'left' | 'right') => void
      onEditDiscard?: (side: 'left' | 'right') => void
      onCopyHunkLeft?: (hunkIndex: number) => void
      onCopyHunkRight?: (hunkIndex: number) => void
    }
  ) {
    const hunks = splitHunksFromText(this.props.diff ? renderDiffText(this.props.diff) : '')
    const charDiffParts: ReadonlyArray<ICharDiffPart> =
      hunks.length > 0
        ? computeCharDiff(state.leftContent, state.rightContent)
        : []

    return (
      <div className="meld-diff-pane-editors">
        <div className="meld-diff-pane-side-by-side">
          <MeldEditorPane
            side="left"
            title="Original"
            content={state.leftContent}
            originalContent={state.leftOriginal}
            readOnly={handlers.readOnly}
            hasChanges={state.hasChanges}
            onChange={handlers.onEditChange || (() => undefined)}
            onSave={handlers.onEditSave || (() => undefined)}
            onDiscard={handlers.onEditDiscard || (() => undefined)}
          />
          <MeldCharDiff parts={charDiffParts} className="meld-diff-pane-overlay" />
          <MeldEditorPane
            side="right"
            title="Working"
            content={state.rightContent}
            originalContent={state.rightOriginal}
            readOnly={handlers.readOnly}
            hasChanges={state.hasChanges}
            onChange={handlers.onEditChange || (() => undefined)}
            onSave={handlers.onEditSave || (() => undefined)}
            onDiscard={handlers.onEditDiscard || (() => undefined)}
          />
        </div>
        {hunks.length > 1 && (
          <div className="meld-diff-pane-hunk-buttons" role="list" aria-label="Hunk copy controls">
            {hunks.map((hunkText, index) => (
              <div key={index} role="listitem" className="meld-diff-pane-hunk-row">
                <pre className="meld-diff-pane-hunk-header" aria-hidden="true">
                  {hunkText.split('\n')[0]}
                </pre>
                <MeldCopyButtons
                  hunkIndex={index}
                  label={hunkText.split('\n')[0]}
                  onCopyLeft={handlers.onCopyHunkLeft || (() => undefined)}
                  onCopyRight={handlers.onCopyHunkRight || (() => undefined)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
}
