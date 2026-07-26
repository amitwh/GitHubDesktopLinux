import * as React from 'react'
import * as os from 'os'
import { DialogContent } from '../dialog'
import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import { LinkButton } from '../lib/link-button'
import { Row } from '../lib/row'
import { getVersion } from '../lib/app-proxy'
import { getLogDirectoryPath } from '../../lib/logging/get-log-path'

interface IDiagnosticsPreferencesProps {
  /**
   * Called when the user clicks "Open folder" in the Logs section. The path
   * is provided so the host can decide whether to show the log directory
   * itself or its parent folder.
   */
  readonly onOpenLogsFolder: (path: string) => void

  /**
   * Called when the user clicks "Copy path" in any row. The host copies the
   * value to the clipboard; we keep the call delegate-shaped so the
   * diagnostics tab stays free of clipboard/window globals.
   */
  readonly onCopyValue: (value: string) => void

  /**
   * Resolved path to the git binary. Defaults to `'git'` when no resolver is
   * available — we keep this tab a pure read-only view of system info.
   */
  readonly gitBinaryPath: string
}

interface IDiagnosticsPreferencesState {
  /** Loaded on demand so the tab can render the correct path on first paint. */
  readonly logDirectory: string | null
}

/**
 * Mirror of `app/src/ui/about/about.tsx`'s Linux fork label. Used as the
 * header line on the Diagnostics tab so a build that wasn't compiled with
 * `__LINUX__` still renders the right product name.
 */
const DiagnosticsAppName = __LINUX__ ? 'GitHub Desktop Linux' : 'GitHub Desktop'

/**
 * Upstream issue tracker. We deliberately point at the upstream tracker (not
 * the fork) by default so users get the best chance of a maintainer
 * response; the fork's issue tracker is reserved for fork-specific
 * regressions.
 */
const UpstreamIssueTrackerUri = 'https://github.com/desktop/desktop/issues/new'

/**
 * Diagnostics preferences tab. Mostly read-only: it surfaces runtime info
 * (versions, paths, OS) so users have something concrete to share when they
 * file a bug report, plus a couple of action buttons (open / copy) that
 * delegate to the host via callbacks.
 */
export class Diagnostics extends React.Component<
  IDiagnosticsPreferencesProps,
  IDiagnosticsPreferencesState
> {
  public constructor(props: IDiagnosticsPreferencesProps) {
    super(props)

    this.state = {
      logDirectory: null,
    }
  }

  public componentDidMount() {
    // `getLogDirectoryPath` calls into Electron's `app.getPath`, so we have to
    // defer the read until after the component mounts to keep the tab
    // independent of window/Electron globals at module-load time.
    try {
      this.setState({ logDirectory: getLogDirectoryPath() })
    } catch (e) {
      this.setState({ logDirectory: null })
    }
  }

  private onCopyElectronVersion = () => {
    this.props.onCopyValue(process.versions.electron)
  }

  private onCopyChromeVersion = () => {
    this.props.onCopyValue(process.versions.chrome)
  }

  private onCopyNodeVersion = () => {
    this.props.onCopyValue(process.versions.node)
  }

  private onCopyOsLabel = () => {
    this.props.onCopyValue(`${os.type()} ${os.release()}`)
  }

  private onCopyArch = () => {
    this.props.onCopyValue(os.arch())
  }

  private onCopyLogDir = () => {
    if (this.state.logDirectory !== null) {
      this.props.onCopyValue(this.state.logDirectory)
    }
  }

  private onCopyGitBinary = () => {
    this.props.onCopyValue(this.props.gitBinaryPath)
  }

  private onCopyAppVersion = () => {
    this.props.onCopyValue(getVersion())
  }

  private onOpenLogsFolderClicked = () => {
    const dir = this.state.logDirectory
    if (dir === null) {
      return
    }
    this.props.onOpenLogsFolder(dir)
  }

  public render() {
    const logDirectory = this.state.logDirectory ?? '(unavailable)'
    const osLabel = `${os.type()} ${os.release()}`

    return (
      <DialogContent>
        <div className="advanced-section">
          <h2>{DiagnosticsAppName}</h2>
          <p className="settings-description">
            Diagnostic information about your installation. Use the copy
            buttons or the "Open upstream issue tracker" link below when
            reporting a bug.
          </p>
        </div>

        <div className="advanced-section">
          <h2>Platform info</h2>

          <Row>
            <TextBox
              label="Electron version"
              value={process.versions.electron}
              readOnly={true}
            />
            <LinkButton onClick={this.onCopyElectronVersion}>Copy</LinkButton>
          </Row>

          <Row>
            <TextBox
              label="Chrome version"
              value={process.versions.chrome}
              readOnly={true}
            />
            <LinkButton onClick={this.onCopyChromeVersion}>Copy</LinkButton>
          </Row>

          <Row>
            <TextBox
              label="Node version"
              value={process.versions.node}
              readOnly={true}
            />
            <LinkButton onClick={this.onCopyNodeVersion}>Copy</LinkButton>
          </Row>

          <Row>
            <TextBox label="OS" value={osLabel} readOnly={true} />
            <LinkButton onClick={this.onCopyOsLabel}>Copy</LinkButton>
          </Row>

          <Row>
            <TextBox label="Architecture" value={os.arch()} readOnly={true} />
            <LinkButton onClick={this.onCopyArch}>Copy</LinkButton>
          </Row>
        </div>

        <div className="advanced-section">
          <h2>Logs</h2>
          <Row>
            <TextBox
              label="Log directory"
              value={logDirectory}
              readOnly={true}
            />
            <LinkButton onClick={this.onCopyLogDir}>Copy path</LinkButton>
          </Row>
          <div className="settings-description">
            <p>
              <Button onClick={this.onOpenLogsFolderClicked}>
                Open folder
              </Button>
            </p>
          </div>
        </div>

        <div className="advanced-section">
          <h2>Git</h2>

          <Row>
            <TextBox
              label="Git binary"
              value={this.props.gitBinaryPath}
              readOnly={true}
            />
            <LinkButton onClick={this.onCopyGitBinary}>Copy</LinkButton>
          </Row>

          <Row>
            <TextBox label="App version" value={getVersion()} readOnly={true} />
            <LinkButton onClick={this.onCopyAppVersion}>Copy</LinkButton>
          </Row>
        </div>

        <div className="advanced-section">
          <h2>Reporting</h2>
          <p className="settings-description">
            <LinkButton uri={UpstreamIssueTrackerUri}>
              Open upstream issue tracker
            </LinkButton>
          </p>
          <p className="settings-description">
            <Button onClick={this.onOpenLogsFolderClicked}>
              Open local logs folder
            </Button>
          </p>
        </div>
      </DialogContent>
    )
  }
}
