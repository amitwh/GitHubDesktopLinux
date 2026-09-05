import * as React from 'react'
import {
  IRebaseCommitStats,
  formatStatsSummary,
} from '../../lib/meld/rebasePreview'

/**
 * Phase 3 (Rebase Preview): a single row in the interactive-rebase
 * planner that surfaces aggregate diff stats and a "View diff"
 * button for each commit. Render-only — the parent owns the actual
 * commit ordering, the `pick / squash / fixup / drop` action state,
 * and any IPC.
 *
 * Spec: docs/superpowers/specs/2026-06-05-meld-style-diff-viewer-design.md
 *       (Phase 3 — Interactive Rebase Preview).
 */

export interface IRebaseCommit {
  readonly sha: string
  /** First line of the commit message. */
  readonly summary: string
}

export interface IMeldRebasePreviewProps {
  /**
   * The commits currently in the rebase list, in user-controlled order.
   * The parent already filters out drops when starting the rebase, but
   * the component should still receive dropped entries so the user can
   * see *which* commits will be excluded (the row shows the summary
   * and a disabled "View diff" button).
   */
  readonly commits: ReadonlyArray<IRebaseCommit>

  /**
   * Aggregate stats keyed by commit SHA. Stats for a commit are
   * missing when the fetch is still in flight — the row renders a
   * muted "Loading stats…" indicator for those entries.
   */
  readonly stats: {
    readonly [sha: string]: IRebaseCommitStats | undefined
  }

  /**
   * Per-commit loading flag set, keyed by SHA. The parent can choose
   * to either populate this map eagerly (as soon as a stats fetch
   * starts) or never set it (in which case stats simply appear when
   * the fetch resolves).
   */
  readonly loading?: {
    readonly [sha: string]: boolean | undefined
  }

  /**
   * Called when the user clicks the "View diff" button on a row. The
   * parent (typically the InteractiveRebaseDialog) is responsible for
   * opening the Meld window in commit mode for that SHA.
   */
  readonly onViewDiff: (sha: string) => void

  /**
   * Optional predicate: returns true for commits that have been
   * marked as `drop` in the rebase list. The component disables the
   * "View diff" button for those (the user already excluded them
   * from the eventual history).
   */
  readonly isDropped?: (sha: string) => boolean
}

/**
 * Stable short SHA for tooltips / aria-labels. We deliberately cap at
 * 7 chars to match `git log --abbrev=7` which is what `Interactive
 * Rebase` (the parent dialog) already shows.
 */
function shortSha(sha: string): string {
  return sha.length > 7 ? sha.substring(0, 7) : sha
}

/**
 * Phase 3 — Interactive Rebase Preview. One row per commit in the
 * rebase list, showing the aggregate diff stats and a "View diff"
 * button. Stats update live as the parent reorders / squashes /
 * fixups / drops commits (the parent passes the updated `commits`
 * array; the component just renders).
 */
export class MeldRebasePreview extends React.Component<IMeldRebasePreviewProps> {
  public render() {
    const { commits } = this.props
    return (
      <div
        className="meld-rebase-preview"
        role="table"
        aria-label="Per-commit diff preview"
      >
        <div className="meld-rebase-preview-header" role="row">
          <span className="meld-rebase-preview-header-sha" role="columnheader">
            SHA
          </span>
          <span
            className="meld-rebase-preview-header-summary"
            role="columnheader"
          >
            Message
          </span>
          <span
            className="meld-rebase-preview-header-stats"
            role="columnheader"
          >
            Changes
          </span>
          <span
            className="meld-rebase-preview-header-action"
            role="columnheader"
          />
        </div>
        {commits.map(commit => this.renderRow(commit))}
      </div>
    )
  }

  private onViewDiffClick = (sha: string) => () => {
    this.props.onViewDiff(sha)
  }

  private renderRow(commit: IRebaseCommit) {
    const { sha } = commit
    const isDropped = this.props.isDropped ? this.props.isDropped(sha) : false
    const stats = this.props.stats[sha]
    // An entry is "loading" when:
    //   - the parent explicitly marked it loading (`loading[sha] === true`)
    //   - OR there are no stats yet AND the parent has not said "done"
    //     (`loading[sha]` is undefined or not `false`).
    // When `loading[sha] === false`, we treat that as "fetch complete,
    // stats may be empty/zero" and fall through to render the real stats.
    const isLoading =
      (this.props.loading !== undefined && this.props.loading[sha] === true) ||
      (stats === undefined &&
        (this.props.loading === undefined || this.props.loading[sha] !== false))

    return (
      <div
        key={sha}
        className={
          'meld-rebase-preview-row' +
          (isDropped ? ' meld-rebase-preview-row-dropped' : '')
        }
        role="row"
        data-sha={sha}
      >
        <span
          className="meld-rebase-preview-sha"
          role="cell"
          aria-label={`Commit ${shortSha(sha)}`}
        >
          {shortSha(sha)}
        </span>
        <span className="meld-rebase-preview-summary" role="cell">
          {commit.summary}
        </span>
        <span className="meld-rebase-preview-stats" role="cell">
          {this.renderStats(stats, isLoading)}
        </span>
        <span className="meld-rebase-preview-action" role="cell">
          <button
            type="button"
            className="meld-rebase-preview-view-diff-button"
            disabled={isDropped || isLoading}
            aria-label={
              isDropped
                ? `View diff for ${shortSha(sha)} (dropped)`
                : `View diff for ${shortSha(sha)}`
            }
            onClick={this.onViewDiffClick(sha)}
          >
            View diff
          </button>
        </span>
      </div>
    )
  }

  private renderStats(
    stats: IRebaseCommitStats | undefined,
    isLoading: boolean
  ): React.ReactNode {
    if (isLoading) {
      return (
        <span className="meld-rebase-preview-stats-loading" aria-live="polite">
          Loading stats…
        </span>
      )
    }
    if (stats === undefined) {
      // Defensive — should be covered by isLoading above.
      return <span className="meld-rebase-preview-stats-empty">—</span>
    }
    return (
      <span className="meld-rebase-preview-stats-text">
        {formatStatsSummary(stats)}
      </span>
    )
  }
}
