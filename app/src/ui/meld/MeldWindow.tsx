import * as React from 'react'
import { IExternalTool } from '../../models/external-tool'
import { IDiff, ITextDiff, ILargeTextDiff, DiffType } from '../../models/diff'
import { IMeldEditState } from '../../models/meld-edit'
import { IThreeWayState, IConflictHunk } from '../../models/meld-merge'
import { MeldFileTree, IMeldFile } from './MeldFileTree'
import { MeldDiffPane } from './MeldDiffPane'
import { MeldToolbar, IMeldFilter, IMeldMode, IMeldEditMode } from './MeldToolbar'
import { MeldThreeWayView } from './MeldThreeWayView'
import { MeldMergedPane } from './MeldMergedPane'
import { MeldMergeControls } from './MeldMergeControls'
import { applyEdit, revertEdits, copyHunk, IHunkRange } from '../../lib/meld/diffOperations'
import { applyHunkResolution, buildConflictHunks } from '../../lib/meld/conflictMarkers'

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
  /** Merge mode: three-way BASE/LOCAL/REMOTE state */
  readonly threeWayState?: IThreeWayState
  /** Merge mode: delegate to git merge-file for a clean auto-merge */
  readonly onAutoMerge?: (
    repositoryID: number,
    filePath: string
  ) => Promise<{ mergedContent: string; clean: boolean }>
  /** Merge mode: write merged content + stage the file */
  readonly onMarkMergeResolved?: (
    repositoryID: number,
    filePath: string,
    mergedContent: string
  ) => Promise<{ success: boolean; error?: string }>
  /**
   * Merge mode: per-hunk resolution callback.
   * Called when the user clicks Accept LOCAL / Accept REMOTE / Use BASE
   * in MeldMergedPane. The window handles the state update internally;
   * this prop lets the parent persist or log if needed.
   */
  readonly onHunkResolved?: (
    repositoryID: number,
    filePath: string,
    hunkIndex: number,
    side: 'base' | 'local' | 'remote'
  ) => void
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
  /** Merge mode: the current merged file content (updated as hunks are resolved) */
  readonly mergedContent: string | null
  /**
   * Merge mode: the currently-selected hunk index in BASE-coord space.
   * Derived from the MERGED-coord hunk index selected in MeldMergedPane
   * by looking up the equivalent hunk in BASE/LOCAL/REMOTE content via
   * computeBaseHunks(). null when no hunk is selected.
   */
  readonly activeHunkIndex: number | null
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
      mergedContent: props.threeWayState?.mergedContent ?? null,
      activeHunkIndex: null,
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

  public componentDidUpdate(prevProps: IMeldWindowProps) {
    // When threeWayState changes (e.g., initial load or external refresh),
    // reset mergedContent so the UI reflects the latest state.
    if (
      this.props.threeWayState !== prevProps.threeWayState &&
      this.props.threeWayState !== undefined
    ) {
      this.setState({
        mergedContent: this.props.threeWayState.mergedContent,
        activeHunkIndex: null,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Merge-mode private helpers
  // ---------------------------------------------------------------------------

  /**
   * Replicate the same line-diff algorithm as MeldThreeWayView.computeHunks
   * so we can derive a BASE-coord IConflictHunk from a MERGED-coord hunk index.
   *
   * Decision: we match by hunk index (not by line number), because the hunks
   * appear in the same order across BASE/LOCAL/REMOTE. This is simpler and
   * more robust than trying to translate MERGED-space line numbers to BASE-
   * space (which would require accounting for conflict marker lines that
   * exist only in the MERGED file).
   */
  private computeBaseHunks(baseLines: ReadonlyArray<string>, localLines: ReadonlyArray<string>, remoteLines: ReadonlyArray<string>): IConflictHunk[] {
    const hunks: IConflictHunk[] = []
    let i = 0

    while (i < baseLines.length) {
      const baseLine = baseLines[i]
      const localLine = localLines[i] ?? ''
      const remoteLine = remoteLines[i] ?? ''

      const differs = baseLine !== localLine || baseLine !== remoteLine

      if (differs) {
        const runStart = i
        let runEnd = runStart
        while (
          runEnd < baseLines.length &&
          (baseLines[runEnd] !== (localLines[runEnd] ?? '') ||
            baseLines[runEnd] !== (remoteLines[runEnd] ?? ''))
        ) {
          runEnd++
        }

        const runBaseContent = baseLines.slice(runStart, runEnd).join('\n')
        const runLocalContent = localLines.slice(runStart, runEnd).join('\n')
        const runRemoteContent = remoteLines.slice(runStart, runEnd).join('\n')

        hunks.push({
          baseContent: runBaseContent,
          localContent: runLocalContent,
          remoteContent: runRemoteContent,
          startLine: runStart,
          endLine: runEnd - 1,
        })

        i = runEnd
      } else {
        i++
      }
    }

    return hunks
  }

  /**
   * Given a MERGED-coord hunk index, find the equivalent IConflictHunk in
   * BASE-coord space by computing hunks in BASE/LOCAL/REMOTE and matching by
   * index. Returns null if the index is out of range.
   */
  private getActiveHunk(hunkIndex: number): IConflictHunk | null {
    const { threeWayState } = this.props
    if (!threeWayState) return null

    const baseLines = threeWayState.baseContent.split('\n')
    const localLines = threeWayState.localContent.split('\n')
    const remoteLines = threeWayState.remoteContent.split('\n')

    const baseHunks = this.computeBaseHunks(baseLines, localLines, remoteLines)
    return baseHunks[hunkIndex] ?? null
  }

  private onMergeHunkResolved = (hunkIndex: number, side: 'base' | 'local' | 'remote') => {
    const { mergedContent } = this.state
    if (!mergedContent) return

    const updated = applyHunkResolution(mergedContent, hunkIndex, side)
    this.setState({ mergedContent: updated })

    // Notify parent so it can persist / log if needed
    if (this.props.onHunkResolved) {
      this.props.onHunkResolved(
        this.props.repositoryID,
        this.props.filePath,
        hunkIndex,
        side,
      )
    }
  }

  private onMergeAutoMerge = async () => {
    if (!this.props.onAutoMerge) return
    try {
      const result = await this.props.onAutoMerge(
        this.props.repositoryID,
        this.props.filePath,
      )
      this.setState({ mergedContent: result.mergedContent })
    } catch (e) {
      this.setState({
        errorMessage: e instanceof Error ? e.message : 'Auto-merge failed',
      })
    }
  }

  private onMergeMarkResolved = async () => {
    const { mergedContent } = this.state
    if (!mergedContent || !this.props.onMarkMergeResolved) return

    const result = await this.props.onMarkMergeResolved(
      this.props.repositoryID,
      this.props.filePath,
      mergedContent,
    )
    if (!result.success) {
      this.setState({ errorMessage: result.error || 'Failed to mark as resolved' })
    }
  }

  private onMergeContentChange = (content: string) => {
    this.setState({ mergedContent: content })
  }

  private onMergeHunkClicked = (hunk: IConflictHunk) => {
    // Find the index of this hunk in BASE-coord space by matching startLine/endLine.
    // (The hunk was produced by computeBaseHunks so we can use index lookup.)
    const { threeWayState } = this.props
    if (!threeWayState) return

    const baseLines = threeWayState.baseContent.split('\n')
    const localLines = threeWayState.localContent.split('\n')
    const remoteLines = threeWayState.remoteContent.split('\n')
    const baseHunks = this.computeBaseHunks(baseLines, localLines, remoteLines)
    const idx = baseHunks.findIndex(h => h.startLine === hunk.startLine && h.endLine === hunk.endLine)
    this.setState({ activeHunkIndex: idx >= 0 ? idx : null })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  public render() {
    const { files, availableTools, filePath, mode: windowMode } = this.props
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
      mergedContent,
      activeHunkIndex,
    } = this.state

    const toolbar = (
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
    )

    const errorBanner = errorMessage && (
      <div className="meld-error-banner" role="alert">
        {errorMessage}
      </div>
    )

    const fileChangedBanner = fileChangedSinceLoad && (
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
    )

    const footer = (
      <div className="meld-window-footer">
        <button
          type="button"
          onClick={this.props.onClose}
          aria-label="Close Meld window"
        >
          Close
        </button>
      </div>
    )

    // -----------------------------------------------------------------------
    // Merge mode: three-way BASE/LOCAL/REMOTE + editable MERGED pane
    // -----------------------------------------------------------------------
    if (windowMode === 'merge') {
      const { threeWayState } = this.props

      if (!threeWayState) {
        return (
          <div className="meld-window">
            {toolbar}
            {errorBanner}
            <div className="meld-window-body meld-merge-loading">
              <span>Loading merge state…</span>
            </div>
            {footer}
          </div>
        )
      }

      // Derive the BASE-coord active hunk from the MERGED-coord activeHunkIndex.
      // computeBaseHunks produces hunks in the same order across all three panes,
      // so we match by index rather than translating MERGED line coords to BASE.
      const activeHunk =
        activeHunkIndex !== null ? this.getActiveHunk(activeHunkIndex) : null

      // Recompute conflict hunks in MERGED space for the action bars.
      const mergedHunks = buildConflictHunks(mergedContent ?? threeWayState.mergedContent)
      const hasUnresolvedConflicts = mergedHunks.length > 0

      return (
        <div className="meld-window">
          {toolbar}
          {errorBanner}
          <div className="meld-window-body meld-merge-body">
            <MeldThreeWayView
              baseContent={threeWayState.baseContent}
              localContent={threeWayState.localContent}
              remoteContent={threeWayState.remoteContent}
              activeHunk={activeHunk}
              onHunkClicked={this.onMergeHunkClicked}
            />
            <MeldMergedPane
              content={mergedContent ?? threeWayState.mergedContent}
              hunks={mergedHunks}
              readOnly={false}
              onContentChange={this.onMergeContentChange}
              onHunkResolved={this.onMergeHunkResolved}
            />
            <MeldMergeControls
              hasUnresolvedConflicts={hasUnresolvedConflicts}
              onAutoMerge={this.onMergeAutoMerge}
              onMarkResolved={this.onMergeMarkResolved}
            />
          </div>
          {footer}
        </div>
      )
    }

    // -----------------------------------------------------------------------
    // Working / commit mode: file tree + diff pane (existing layout)
    // -----------------------------------------------------------------------
    return (
      <div className="meld-window">
        {toolbar}
        {errorBanner}
        {fileChangedBanner}
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
        {footer}
      </div>
    )
  }
}
