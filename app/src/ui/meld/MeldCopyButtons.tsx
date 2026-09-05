import * as React from 'react'

export interface IMeldCopyButtonsProps {
  readonly hunkIndex: number
  readonly onCopyLeft: (hunkIndex: number) => void
  readonly onCopyRight: (hunkIndex: number) => void
  /**
   * Optional label shown to the left of the buttons (typically the
   * hunk's `@ -N,M +N,M` header). Pass `null` to render no label.
   */
  readonly label?: string | null
}

/**
 * Per-hunk copy controls. Rendered between the two editor panes so the
 * user can pull text from one side to the other with a single click.
 * The buttons are presentational: they call back into the parent's
 * `onCopyLeft` / `onCopyRight` handlers with the hunk index.
 */
export class MeldCopyButtons extends React.Component<
  IMeldCopyButtonsProps,
  {}
> {
  private onCopyLeftClicked = () => {
    this.props.onCopyLeft(this.props.hunkIndex)
  }

  private onCopyRightClicked = () => {
    this.props.onCopyRight(this.props.hunkIndex)
  }

  public render() {
    const { label, hunkIndex } = this.props
    return (
      <div
        className="meld-copy-buttons"
        role="group"
        aria-label={
          label ? `Hunk ${hunkIndex + 1}: ${label}` : `Hunk ${hunkIndex + 1}`
        }
      >
        <button
          type="button"
          className="meld-copy-buttons-to-left"
          aria-label="Copy to left"
          data-direction="left"
          onClick={this.onCopyLeftClicked}
        >
          ←
        </button>
        <button
          type="button"
          className="meld-copy-buttons-to-right"
          aria-label="Copy to right"
          data-direction="right"
          onClick={this.onCopyRightClicked}
        >
          →
        </button>
      </div>
    )
  }
}
