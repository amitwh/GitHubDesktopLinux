import * as React from 'react'
import { IExternalTool } from '../../models/external-tool'
import { IDiff } from '../../models/diff'
import { MeldFileTree, IMeldFile } from './MeldFileTree'
import { MeldDiffPane } from './MeldDiffPane'
import { MeldToolbar, IMeldFilter, IMeldMode } from './MeldToolbar'

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
  readonly onClose: () => void
}

interface IMeldWindowState {
  readonly selectedPath: string | null
  readonly diff: IDiff | null
  readonly diffLoading: boolean
  readonly filter: IMeldFilter
  readonly mode: IMeldMode
  readonly errorMessage: string | null
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
      errorMessage: null,
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
      this.setState({ diff, diffLoading: false, selectedPath: filePath })
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

  public render() {
    const { files, availableTools, filePath } = this.props
    const { selectedPath, diff, diffLoading, filter, mode, errorMessage } =
      this.state
    return (
      <div className="meld-window">
        <MeldToolbar
          repositoryName={`Repository ${this.props.repositoryID}`}
          filePath={selectedPath || filePath}
          filter={filter}
          mode={mode}
          availableTools={availableTools}
          onFilterChanged={this.onFilterChanged}
          onModeChanged={this.onModeChanged}
          onExternalToolLaunched={this.onExternalToolLaunched}
        />
        {errorMessage && (
          <div className="meld-error-banner" role="alert">
            {errorMessage}
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
