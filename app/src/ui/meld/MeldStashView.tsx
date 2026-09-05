import * as React from 'react'
import { IAllStashEntry } from '../../lib/git/stash'
import { CommittedFileChange, AppFileStatusKind } from '../../models/status'

/**
 * Phase 2 (T2, MeldStashView): props for the stash view component.
 *
 * The component is intentionally narrow — it doesn't know about
 * `git` directly. The parent (`MeldWindow` in stash mode, or the
 * mount point in `index.tsx`) wires the IPC fetchers and dispatches
 * the resulting diff to the existing `MeldDiffPane`.
 */
export interface IMeldStashViewProps {
  /**
   * Fetches the list of all stash entries for the current repository.
   * Returns an empty array when the repository has no stashes.
   */
  readonly onGetStashes: () => Promise<ReadonlyArray<IAllStashEntry>>

  /**
   * Fetches the list of files changed in a specific stash entry.
   * Called when the user expands a stash node.
   */
  readonly onGetStashFiles: (
    stashSha: string
  ) => Promise<ReadonlyArray<CommittedFileChange>>

  /**
   * Called when the user selects a file under a stash node. The
   * parent resolves this into the existing Meld window diff flow
   * (which already supports commit-mode diffing against a base SHA).
   */
  readonly onFileSelected: (stashSha: string, filePath: string) => void

  /**
   * Optional initial stash SHA to expand on mount (typically taken
   * from the URL hash so deep-linking from `stash-manager-dialog`
   * lands on the right entry).
   */
  readonly initialStashSha?: string
}

interface IExpandedStash {
  readonly sha: string
  readonly files: ReadonlyArray<CommittedFileChange> | null
  readonly loading: boolean
  readonly error: string | null
}

interface IMeldStashViewState {
  readonly stashes: ReadonlyArray<IAllStashEntry>
  readonly loading: boolean
  readonly error: string | null
  readonly expanded: ReadonlyMap<string, IExpandedStash>
  readonly selected: {
    readonly stashSha: string
    readonly filePath: string
  } | null
}

/**
 * Phase 2 (T2, MeldStashView): a small two-pane component for
 * browsing stash entries. The left column lists stash nodes
 * (expandable); the right column shows the diff for the
 * currently-selected file inside the currently-expanded stash.
 *
 * The component is presentation-only and delegates git fetching
 * and diff rendering to props. When no file is selected it shows
 * a small empty-state hint.
 */
export class MeldStashView extends React.Component<
  IMeldStashViewProps,
  IMeldStashViewState
> {
  public constructor(props: IMeldStashViewProps) {
    super(props)
    this.state = {
      stashes: [],
      loading: true,
      error: null,
      expanded: new Map(),
      selected: null,
    }
  }

  public async componentDidMount() {
    await this.loadStashes()
    if (this.props.initialStashSha !== undefined) {
      void this.expandStash(this.props.initialStashSha)
    }
  }

  private async loadStashes() {
    try {
      const stashes = await this.props.onGetStashes()
      this.setState({ stashes, loading: false, error: null })
    } catch (e) {
      this.setState({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load stashes',
      })
    }
  }

  private toggleStash = (stashSha: string) => () => {
    void this.expandStash(stashSha)
  }

  private expandStash = async (stashSha: string) => {
    // Toggle: if already expanded with loaded files, collapse.
    const existing = this.state.expanded.get(stashSha)
    if (existing !== undefined && existing.files !== null) {
      const next = new Map(this.state.expanded)
      next.delete(stashSha)
      this.setState({ expanded: next, selected: null })
      return
    }

    // Mark as loading so the row can render a spinner cell.
    const loadingMap = new Map(this.state.expanded)
    loadingMap.set(stashSha, {
      sha: stashSha,
      files: null,
      loading: true,
      error: null,
    })
    this.setState({ expanded: loadingMap })

    try {
      const files = await this.props.onGetStashFiles(stashSha)
      const next = new Map(this.state.expanded)
      next.set(stashSha, {
        sha: stashSha,
        files,
        loading: false,
        error: null,
      })
      this.setState({ expanded: next })
    } catch (e) {
      const next = new Map(this.state.expanded)
      next.set(stashSha, {
        sha: stashSha,
        files: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load files',
      })
      this.setState({ expanded: next })
    }
  }

  private openStashFile = (stashSha: string, filePath: string) => () => {
    this.selectFile(stashSha, filePath)
  }

  private selectFile = (stashSha: string, filePath: string) => {
    this.setState({ selected: { stashSha, filePath } })
    this.props.onFileSelected(stashSha, filePath)
  }

  public render() {
    const { stashes, loading, error, expanded, selected } = this.state

    const errorBanner = error && (
      <div className="meld-error-banner" role="alert">
        {error}
      </div>
    )

    if (loading) {
      return (
        <div className="meld-stash-view">
          {errorBanner}
          <div className="meld-stash-loading">Loading stashes…</div>
        </div>
      )
    }

    if (stashes.length === 0) {
      return (
        <div className="meld-stash-view">
          {errorBanner}
          <div className="meld-stash-empty">No stashes found.</div>
        </div>
      )
    }

    return (
      <div className="meld-stash-view">
        {errorBanner}
        <div className="meld-stash-list" role="tree" aria-label="Stash entries">
          {stashes.map(stash => this.renderStashNode(stash, expanded))}
        </div>
        <div className="meld-stash-selection">
          {selected === null ? (
            <span className="meld-stash-hint">
              Select a file to view its diff.
            </span>
          ) : (
            <span
              className="meld-stash-selection-label"
              data-testid="meld-stash-selection"
            >
              {selected.filePath}
            </span>
          )}
        </div>
      </div>
    )
  }

  private renderStashNode(
    stash: IAllStashEntry,
    expanded: ReadonlyMap<string, IExpandedStash>
  ) {
    const ex = expanded.get(stash.stashSha)
    const isExpanded = ex !== undefined

    return (
      <div
        key={stash.stashSha}
        className="meld-stash-node"
        data-stash-sha={stash.stashSha}
      >
        <button
          type="button"
          className="meld-stash-toggle"
          aria-expanded={isExpanded}
          data-testid={`meld-stash-toggle-${stash.stashSha}`}
          onClick={this.toggleStash(stash.stashSha)}
        >
          <span className="meld-stash-marker">{isExpanded ? '▾' : '▸'}</span>
          <span className="meld-stash-name">{stash.name}</span>
          <span className="meld-stash-sha">
            {stash.stashSha.substring(0, 7)}
          </span>
          <span className="meld-stash-message">{stash.message}</span>
        </button>
        {isExpanded && this.renderExpandedBody(stash, ex!)}
      </div>
    )
  }

  private renderExpandedBody(stash: IAllStashEntry, ex: IExpandedStash) {
    if (ex.loading) {
      return (
        <div className="meld-stash-files meld-stash-files-loading">
          Loading files…
        </div>
      )
    }
    if (ex.error !== null) {
      return (
        <div className="meld-stash-files meld-stash-files-error" role="alert">
          {ex.error}
        </div>
      )
    }
    const files = ex.files ?? []
    if (files.length === 0) {
      return (
        <div className="meld-stash-files meld-stash-files-empty">
          No files in this stash.
        </div>
      )
    }
    return (
      <ul
        className="meld-stash-files"
        role="group"
        aria-label={`Files in ${stash.name}`}
      >
        {files.map(f => this.renderStashFileRow(stash.stashSha, f))}
      </ul>
    )
  }

  private renderStashFileRow(stashSha: string, file: CommittedFileChange) {
    const isSelected =
      this.state.selected !== null &&
      this.state.selected.stashSha === stashSha &&
      this.state.selected.filePath === file.path

    return (
      <li
        key={file.path}
        className="meld-stash-file-row"
        data-status={stashFileStatus(file)}
        data-selected={isSelected}
        data-testid={`meld-stash-file-${file.path}`}
      >
        <button
          type="button"
          className="meld-stash-file-button"
          onClick={this.openStashFile(stashSha, file.path)}
          aria-label={`Open diff for ${file.path} in stash ${stashSha.substring(
            0,
            7
          )}`}
        >
          <span
            className={`meld-file-status meld-file-status-${stashFileStatus(
              file
            )}`}
            aria-hidden="true"
          >
            {stashFileStatusIcon(file)}
          </span>
          <span className="meld-file-path">{file.path}</span>
        </button>
      </li>
    )
  }
}

/** Coarse status letter for a stash file row. */
function stashFileStatus(file: CommittedFileChange): string {
  switch (file.status.kind) {
    case AppFileStatusKind.New:
      return 'added'
    case AppFileStatusKind.Deleted:
      return 'deleted'
    case AppFileStatusKind.Renamed:
      return 'renamed'
    case AppFileStatusKind.Copied:
      return 'added'
    case AppFileStatusKind.Modified:
      return 'modified'
    default:
      return 'modified'
  }
}

function stashFileStatusIcon(file: CommittedFileChange): string {
  switch (file.status.kind) {
    case AppFileStatusKind.New:
      return 'A'
    case AppFileStatusKind.Deleted:
      return 'D'
    case AppFileStatusKind.Renamed:
      return 'R'
    case AppFileStatusKind.Copied:
      return 'A'
    default:
      return 'M'
  }
}
