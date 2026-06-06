import * as React from 'react'
import { IExternalTool } from '../../models/external-tool'
import { IDiff, ITextDiff, ILargeTextDiff, DiffType } from '../../models/diff'
import { IMeldEditState } from '../../models/meld-edit'
import { MeldFileTree, IMeldFile } from './MeldFileTree'
import { MeldDiffPane } from './MeldDiffPane'
import { MeldToolbar, IMeldFilter, IMeldMode, IMeldEditMode } from './MeldToolbar'
import { applyEdit, revertEdits, copyHunk, IHunkRange } from '../../lib/meld/diffOperations'

export type IMeldWindowMode = 'working' | 'commit' | 'merge'

export interface IMeldWindowProps {
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: IMeldWindowMode
  readonly files: ReadonlyArray<IMeldFile>
  readonly availableTools: ReadonlyArray<IExternalTool>
  readonly onGetDiff: (
    repositoryID: number,
    filePath: string,
    mode: IMeldWindowMode
  ) => Promise<IDiff>
  readonly onLaunchExternalTool: (
    tool: IExternalTool,
    leftPath: string,
    rightPath: string,
    basePath?: string
  ) => Promise<{ success: boolean; error?: string }>
  /** Save the pending edit to disk + stage the file. */
  readonly onSaveEdit?: (
    repositoryID: number,
    filePath: string,
    mode: IMeldWindowMode,
    content: string
  ) => Promise<{ success: boolean; error?: string }>
  /** Discard the pending edit (no-op for 1a, used by Phase 1b). */
  readonly onDiscardEdit?: (
    repositoryID: number,
    filePath: string,
    mode: IMeldWindowMode
  ) => Promise<void>
  /**
   * Optional Phase 1b check: returns true if the file on disk differs
   * from the originally-loaded content. Used to surface a warning
   * banner after the user starts editing. When omitted, the file-
   * change banner is never shown.
   */
  readonly onCheckFileChanged?: (
    repositoryID: number,
    filePath: string
  ) => Promise<boolean>
  readonly onClose: () => void
}

interface IMeldWindowState {
  readonly selectedPath: string | null
  readonly diff: IDiff | null
  readonly diffLoading: boolean
  readonly filter: IMeldFilter
  readonly mode: IMeldMode
  readonly editMode: IMeldEditMode
  readonly errorMessage: string | null
  readonly editState: IMeldEditState | null
  readonly fileChangedSinceLoad: boolean
}

/**
 * Derive an initial `IMeldEditState` from a loaded `IDiff`. For 1b
 * we use a simple model: the entire diff text is treated as the
 * "left" (original) and the "right" (working) starts equal to the
 * left. Edits are tracked independently. For 1c we will read both
 * sides from git directly.
 */
function editStateFromDiff(diff: IDiff | null): IMeldEditState | null {
  if (diff === null) {
    return null
  }
  let text = ''
  if (diff.kind === DiffType.Text) {
    text = (diff as ITextDiff).text
  } else if (diff.kind === DiffType.LargeText) {
    text = (diff as ILargeTextDiff).text
  } else {
    return null
  }
  return {
    leftContent: text,
    rightContent: text,
    leftOriginal: text,
    rightOriginal: text,
    hasChanges: false,
  }
}

export class MeldWindow extends React.Component<IMeldWindowProps, IMeldWindowState> {
  public constructor(props: IMeldWindowProps) {
    super(props)
    this.state = {
      selectedPath: props.filePath,
      diff: null,
      diffLoading: true,
      filter: 'all',
      mode: 'side-by-side',
      editMode: 'view',
      errorMessage: null,
      editState: null,
      fileChangedSinceLoad: false,
    }
  }

  public componentDidMount() {
    void this.loadDiff(this.props.filePath)
  }

  private async loadDiff(filePath: string) {
    this.setState({ diffLoading: true, errorMessage: null })
    try {
      const diff = await this.props.onGetDiff(
        this.props.repositoryID,
        filePath,
        this.props.mode
      )
      this.setState({
        diff,
        diffLoading: false,
        selectedPath: filePath,
        editState: editStateFromDiff(diff),
        fileChangedSinceLoad: false,
      })
    } catch (e) {
      this.setState({
        diffLoading: false,
        errorMessage:
          e instanceof Error ? e.message : 'Failed to load diff',
      })
    }
  }

  private onFileSelected = (path: string) => {
    void this.loadDiff(path)
  }

  private onFilterChanged = (filter: IMeldFilter) => {
    this.setState({ filter })
  }

  private onModeChanged = (mode: IMeldMode) => {
    this.setState({ mode })
  }

  private onEditModeChanged = (editMode: IMeldEditMode) => {
    this.setState({ editMode })
  }

  private onExternalToolLaunched = async (tool: IExternalTool) => {
    // For 1a, the left/right paths are derived from the file path. Real
    // 3-way diff paths come in 1c.
    const { filePath } = this.props
    const result = await this.props.onLaunchExternalTool(
      tool,
      filePath + '.left',
      filePath + '.right'
    )
    if (!result.success) {
      this.setState({
        errorMessage: result.error || 'Failed to launch tool',
      })
    }
  }

  private onEditorChange = (side: 'left' | 'right', value: string) => {
    if (this.state.editState === null) {
      return
    }
    this.setState({
      editState: applyEdit(this.state.editState, side, value),
    })
  }

  private onEditorSave = async (side: 'left' | 'right') => {
    if (this.state.editState === null) {
      return
    }
    if (!this.props.onSaveEdit) {
      this.setState({ errorMessage: 'Save handler is not configured' })
      return
    }
    // Phase 1b: detect if the file on disk has changed since we
    // loaded it. We delegate to the dispatcher (which can read the
    // working directory file or query git status) and stash the
    // result in state. The banner is already rendered conditionally
    // on `fileChangedSinceLoad`.
    if (this.props.onCheckFileChanged) {
      try {
        const changed = await this.props.onCheckFileChanged(
          this.props.repositoryID,
          this.props.filePath
        )
        if (changed) {
          this.setState({ fileChangedSinceLoad: true })
        }
      } catch {
        // Best-effort — fall through to the save.
      }
    }
    const content = side === 'left'
      ? this.state.editState.leftContent
      : this.state.editState.rightContent
    const result = await this.props.onSaveEdit(
      this.props.repositoryID,
      this.props.filePath,
      this.props.mode,
      content
    )
    if (!result.success) {
      this.setState({ errorMessage: result.error || 'Failed to save edit' })
      return
    }
    // The save succeeded; advance the originals so further edits are
    // diffed against the just-saved content.
    this.setState({
      editState: {
        ...this.state.editState,
        leftOriginal: this.state.editState.leftContent,
        rightOriginal: this.state.editState.rightContent,
        hasChanges: false,
      },
    })
  }

  private onEditorDiscard = (side: 'left' | 'right') => {
    if (this.state.editState === null) {
      return
    }
    this.setState({ editState: revertEdits(this.state.editState) })
    if (this.props.onDiscardEdit) {
      void this.props.onDiscardEdit(
        this.props.repositoryID,
        this.props.filePath,
        this.props.mode
      )
    }
  }

  private onCopyHunk = (
    hunkIndex: number,
    direction: 'left' | 'right'
  ) => {
    if (this.state.editState === null) {
      return
    }
    // Reuse copyHunk to swap a slice of text between the two panes.
    // For 1b we use the entire content as the source/target — a
    // simpler approximation of the per-hunk copy that will be
    // refined in 1c once we have structured hunk ranges.
    const target = direction === 'left'
      ? this.state.editState.leftContent
      : this.state.editState.rightContent
    const source = direction === 'left'
      ? this.state.editState.rightContent
      : this.state.editState.leftContent
    const range: IHunkRange = { start: hunkIndex, end: hunkIndex }
    const next = copyHunk(source, target, range)
    this.onEditorChange(direction, next)
  }

  private onCopyHunkLeftBound = (i: number) => this.onCopyHunk(i, 'left')
  private onCopyHunkRightBound = (i: number) => this.onCopyHunk(i, 'right')

  private onReloadFromDisk = () => {
    void this.loadDiff(this.props.filePath)
  }

  public render() {
    const { files, availableTools, filePath } = this.props
    const {
      selectedPath,
      diff,
      diffLoading,
      filter,
      mode,
      editMode,
      errorMessage,
      editState,
      fileChangedSinceLoad,
    } = this.state
    return (
      <div className="meld-window">
        <MeldToolbar
          repositoryName={`Repository ${this.props.repositoryID}`}
          filePath={selectedPath || filePath}
          filter={filter}
          mode={mode}
          editMode={editMode}
          availableTools={availableTools}
          onFilterChanged={this.onFilterChanged}
          onModeChanged={this.onModeChanged}
          onEditModeChanged={this.onEditModeChanged}
          onExternalToolLaunched={this.onExternalToolLaunched}
        />
        {errorMessage && (
          <div className="meld-error-banner" role="alert">
            {errorMessage}
          </div>
        )}
        {fileChangedSinceLoad && (
          <div
            className="meld-file-changed-warning"
            role="alert"
            data-testid="file-changed-warning"
          >
            The file has changed on disk since the diff was loaded.{' '}
            <button
              type="button"
              onClick={this.onReloadFromDisk}
              aria-label="Reload from disk"
            >
              Reload from disk
            </button>
          </div>
        )}
        <div className="meld-window-body">
          <MeldFileTree
            files={files}
            selectedPath={selectedPath}
            onFileSelected={this.onFileSelected}
          />
          <MeldDiffPane
            filePath={selectedPath || filePath}
            diff={diff}
            loading={diffLoading}
            editState={editState}
            readOnly={editMode === 'view'}
            onEditChange={this.onEditorChange}
            onEditSave={this.onEditorSave}
            onEditDiscard={this.onEditorDiscard}
            onCopyHunkLeft={this.onCopyHunkLeftBound}
            onCopyHunkRight={this.onCopyHunkRightBound}
          />
        </div>
        <div className="meld-window-footer">
          <button
            type="button"
            onClick={this.props.onClose}
            aria-label="Close Meld window"
          >
            Close
          </button>
        </div>
      </div>
    )
  }
}
