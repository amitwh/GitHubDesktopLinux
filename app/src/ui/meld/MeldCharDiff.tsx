import * as React from 'react'
import { ICharDiffPart } from '../../lib/meld/diffOperations'

export interface IMeldCharDiffProps {
  readonly parts: ReadonlyArray<ICharDiffPart>
  /** Optional className appended to the wrapper element. */
  readonly className?: string
}

/**
 * Render a char-level diff as inline `<span>` elements. Three BEM
 * modifiers are used:
 *   - `.meld-char-diff-equal`   — unchanged text
 *   - `.meld-char-diff-added`   — present only on the right side
 *   - `.meld-char-diff-removed` — present only on the left side
 *
 * Use as a drop-in highlight for side-by-side panes: in left pane,
 * render parts where `!added`; in right pane, render parts where
 * `!removed`. (See MeldDiffPane for the wiring.)
 */
export class MeldCharDiff extends React.Component<IMeldCharDiffProps, {}> {
  public render() {
    const { parts, className } = this.props
    return (
      <span
        className={
          className ? `meld-char-diff ${className}` : 'meld-char-diff'
        }
      >
        {parts.map((p, i) => this.renderPart(p, i))}
      </span>
    )
  }

  private renderPart(part: ICharDiffPart, index: number) {
    if (part.added) {
      return (
        <span
          key={index}
          className="meld-char-diff-added"
          data-diff="added"
        >
          {part.value}
        </span>
      )
    }
    if (part.removed) {
      return (
        <span
          key={index}
          className="meld-char-diff-removed"
          data-diff="removed"
        >
          {part.value}
        </span>
      )
    }
    return (
      <span key={index} className="meld-char-diff-equal" data-diff="equal">
        {part.value}
      </span>
    )
  }
}
