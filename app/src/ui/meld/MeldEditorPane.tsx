import * as React from 'react'

export interface IMeldEditorPaneProps {
  readonly side: 'left' | 'right'
  readonly title: string
  readonly content: string
  readonly originalContent: string
  readonly readOnly: boolean
  readonly hasChanges: boolean
  readonly onChange: (side: 'left' | 'right', value: string) => void
  readonly onSave: (side: 'left' | 'right') => void
  readonly onDiscard: (side: 'left' | 'right') => void
}

interface IMeldEditorPaneState {
  /** Local value while the user is typing; flushed to parent via `onChange` after a debounce. */
  readonly draft: string
}

/**
 * Editable `<textarea>`-based pane with a line-number gutter, a Save
 * button, and a Discard button. The 1b spec deliberately avoids
 * embedding a full editor (Monaco/CodeMirror) — the char-level diff
 * highlights are rendered as a transparent overlay on top of the
 * textarea, so the editor itself can stay as a vanilla form input.
 */
export class MeldEditorPane extends React.Component<
  IMeldEditorPaneProps,
  IMeldEditorPaneState
> {
  private static readonly DebounceMs = 200

  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  public constructor(props: IMeldEditorPaneProps) {
    super(props)
    this.state = { draft: props.content }
  }

  public componentDidUpdate(prevProps: IMeldEditorPaneProps) {
    // If the parent resets our content (e.g. on Discard or external
    // revert), sync the local draft so the textarea reflects the new
    // truth. We only re-sync when the parent's `content` diverges from
    // our local draft, which is a signal that an external reset happened.
    if (
      prevProps.content !== this.props.content &&
      this.props.content !== this.state.draft
    ) {
      this.setState({ draft: this.props.content })
    }
  }

  public componentWillUnmount() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
    }
  }

  private onTextareaChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    this.setState({ draft: value })
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.props.onChange(this.props.side, value)
    }, MeldEditorPane.DebounceMs)
  }

  private onSaveClicked = () => {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.props.onChange(this.props.side, this.state.draft)
    this.props.onSave(this.props.side)
  }

  private onDiscardClicked = () => {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.setState({ draft: this.props.originalContent })
    this.props.onDiscard(this.props.side)
  }

  public render() {
    const { side, title, readOnly, hasChanges, originalContent } = this.props
    const { draft } = this.state
    const lineCount = Math.max(1, draft.split('\n').length)
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join(
      '\n'
    )

    return (
      <div
        className="meld-editor-pane"
        data-side={side}
        data-readonly={readOnly}
      >
        <div className="meld-editor-pane-header" role="heading" aria-level={3}>
          <span className="meld-editor-pane-title">{title}</span>
          {hasChanges && (
            <span
              className="meld-editor-pane-dirty"
              role="status"
              aria-label="Unsaved changes"
            >
              • unsaved
            </span>
          )}
        </div>
        <div className="meld-editor-pane-body">
          <pre
            className="meld-editor-gutter"
            aria-hidden="true"
            data-testid={`gutter-${side}`}
          >
            {lineNumbers}
          </pre>
          <textarea
            className="meld-editor-textarea"
            value={draft}
            readOnly={readOnly}
            onChange={this.onTextareaChanged}
            spellCheck={false}
            aria-label={`${title} editor`}
            data-testid={`editor-${side}`}
          />
        </div>
        <div className="meld-editor-pane-actions">
          <button
            type="button"
            onClick={this.onSaveClicked}
            disabled={readOnly || !hasChanges}
            aria-label={`Save ${side} pane`}
            data-testid={`save-${side}`}
          >
            Save
          </button>
          <button
            type="button"
            onClick={this.onDiscardClicked}
            disabled={readOnly || !hasChanges}
            aria-label={`Discard ${side} pane`}
            data-testid={`discard-${side}`}
          >
            Discard
          </button>
        </div>
        {/* `originalContent` is consumed by the parent for `hasChanges`;
            unused at render time but read here to keep linter happy
            and document the prop's role. */}
        <span hidden={true} data-original-length={originalContent.length} />
      </div>
    )
  }
}
