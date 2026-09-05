import * as React from 'react'
import { IBlameLine } from '../../lib/meld/blameAlignment'
import { IBlameHunk } from '../../lib/git/blame'

export interface IMeldBlameGutterProps {
  /**
   * One entry per right-side line of the diff, in render order. The
   * `null` entries correspond to lines that have no blame attribution
   * (removed lines, gaps between blame hunks, or untracked files) and
   * are rendered as a blank cell to preserve column alignment.
   *
   * Produced by `alignBlameToDiff(diff.text, blame)`.
   */
  readonly lines: ReadonlyArray<IBlameLine | null>

  /**
   * Invoked when the user clicks a non-empty blame cell. The parent
   * typically opens a new Meld window in `commit` mode for the
   * referenced SHA (the full commit viewer UI is queued for a future
   * Phase 2 follow-up; for now the parent can show a placeholder toast).
   */
  readonly onOpenCommit: (sha: string) => void

  /**
   * Optional loading indicator. When true, the gutter renders a muted
   * "Loading blame…" placeholder in every cell. Defaults to false.
   */
  readonly loading?: boolean
}

/**
 * A left-hand column rendered next to the right pane of the Meld
 * diff editor. One cell per right-side line of the diff, showing
 * `<author-short> @ <sha-short>`. Click a cell to open the
 * corresponding commit; the full attribution (author, SHA, date,
 * commit message) is exposed via `aria-label` for screen readers.
 *
 * Renders as a vertical list whose row count and line-height match the
 * right-pane editor exactly (JetBrains Mono, 13px, 1.5 line-height) so
 * cells align with lines.
 */
export class MeldBlameGutter extends React.Component<IMeldBlameGutterProps> {
  public render() {
    const { lines, loading = false } = this.props

    return (
      <ol
        className="meld-blame-gutter"
        aria-label="Git blame per right-side line"
      >
        {lines.map((line, index) => this.renderCell(line, index, loading))}
      </ol>
    )
  }

  private renderCell(line: IBlameHunk | null, index: number, loading: boolean) {
    if (loading) {
      return (
        <li
          key={index}
          className="meld-blame-gutter-cell meld-blame-gutter-cell-loading"
          aria-hidden="true"
        >
          <span className="meld-blame-gutter-placeholder">…</span>
        </li>
      )
    }

    if (line === null) {
      return (
        <li
          key={index}
          className="meld-blame-gutter-cell meld-blame-gutter-cell-empty"
          aria-hidden="true"
        >
          <span className="meld-blame-gutter-placeholder">····</span>
        </li>
      )
    }

    const author = shortenAuthor(line.author)
    const sha = line.sha.substring(0, 7)
    const dateStr = formatDateForTooltip(line.timestamp)
    // The full attribution goes into `aria-label` so screen readers
    // surface it. (We deliberately do not use a `title` attribute
    // because it's not reliably announced across screen readers and
    // is blocked by the project's `a11y-no-title-attribute` rule.)
    const ariaLabel = `Blame: ${line.author}, ${line.sha}, ${dateStr}, ${line.summary}`

    return (
      <li key={index} className="meld-blame-gutter-cell" aria-label={ariaLabel}>
        <button
          type="button"
          className="meld-blame-gutter-button"
          data-sha={line.sha}
          onClick={this.handleButtonClick}
        >
          <span className="meld-blame-gutter-author">{author}</span>
          <span className="meld-blame-gutter-sha">{sha}</span>
        </button>
      </li>
    )
  }

  private handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const sha = event.currentTarget.getAttribute('data-sha')
    if (sha !== null) {
      this.props.onOpenCommit(sha)
    }
  }
}

/** Truncate author to a 10-char display name (GitHub Desktop convention). */
function shortenAuthor(author: string): string {
  if (author.length <= 10) {
    return author
  }
  return author.substring(0, 9) + '…'
}

/**
 * Format a `Date` for the `title` attribute as `YYYY-MM-DD HH:MM`.
 * Avoids the `toLocaleString` locale variability so hover tooltips are
 * predictable in any environment.
 */
function formatDateForTooltip(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}
