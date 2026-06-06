import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { WorkingDirectoryStatus } from '../../models/status'
import { checkoutConflictedFile } from '../../lib/git/checkout'
import { addConflictedFile } from '../../lib/git/add'
import { ManualConflictResolution } from '../../models/manual-conflict-resolution'
import { Ref } from '../lib/ref'
import { Row } from '../lib/row'
import { Button } from '../lib/button'

interface IMergeConflictDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly workingDirectory: WorkingDirectoryStatus
  readonly onDismissed: () => void
}

interface IMergeConflictDialogState {
  readonly resolvedFiles: Set<string>
}

export class MergeConflictDialog extends React.Component<
  IMergeConflictDialogProps,
  IMergeConflictDialogState
> {
  public constructor(props: IMergeConflictDialogProps) {
    super(props)
    this.state = { resolvedFiles: new Set() }
  }

  private get conflictedFiles() {
    return this.props.workingDirectory.files.filter(
      f => f.status.kind === 'Conflicted'
    )
  }

  private onAcceptOurs = async (path: string) => {
    const file = this.conflictedFiles.find(f => f.path === path)
    if (!file) return
    await checkoutConflictedFile(
      this.props.repository,
      file,
      ManualConflictResolution.ours
    )
    await addConflictedFile(this.props.repository, file)
    this.setState(prev => {
      const resolved = new Set(prev.resolvedFiles)
      resolved.add(path)
      return { resolvedFiles: resolved }
    })
  }

  private onAcceptTheirs = async (path: string) => {
    const file = this.conflictedFiles.find(f => f.path === path)
    if (!file) return
    await checkoutConflictedFile(
      this.props.repository,
      file,
      ManualConflictResolution.theirs
    )
    await addConflictedFile(this.props.repository, file)
    this.setState(prev => {
      const resolved = new Set(prev.resolvedFiles)
      resolved.add(path)
      return { resolvedFiles: resolved }
    })
  }

  private onMarkResolved = async (path: string) => {
    const file = this.conflictedFiles.find(f => f.path === path)
    if (!file) return
    await addConflictedFile(this.props.repository, file)
    this.setState(prev => {
      const resolved = new Set(prev.resolvedFiles)
      resolved.add(path)
      return { resolvedFiles: resolved }
    })
  }

  /**
   * Phase 1c: open this conflicted file in the Meld window in merge mode.
   * The dispatcher resolves the BASE/THEIRS SHAs and the renderer fetches
   * the three-way state on mount. The merge-conflict dialog stays open
   * (per the spec) so the user can mark additional files resolved via
   * the legacy buttons.
   */
  private onOpenInMeldWindow = (path: string) => {
    const file = this.conflictedFiles.find(f => f.path === path)
    if (!file) return
    void this.props.dispatcher.openInMeldWindowMergeMode(
      this.props.repository,
      file.path,
    )
  }

  public render() {
    const files = this.conflictedFiles
    const { resolvedFiles } = this.state

    return (
      <Dialog
        id="merge-conflict"
        title={__DARWIN__ ? 'Resolve Conflicts' : 'Resolve conflicts'}
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          {files.length === 0 && <Row>No conflicted files.</Row>}
          {files.map(file => {
            const isResolved = resolvedFiles.has(file.path)
            return (
              <Row key={file.path} className="conflict-file">
                <span className={isResolved ? 'resolved' : 'conflicted'}>
                  <Ref>{file.path} {isResolved && '(resolved)'}</Ref>
                </span>
                {!isResolved && (
                  <div className="button-group">
                    <Button onClick={() => this.onAcceptOurs(file.path)}>
                      Ours
                    </Button>
                    <Button onClick={() => this.onAcceptTheirs(file.path)}>
                      Theirs
                    </Button>
                    <Button onClick={() => this.onMarkResolved(file.path)}>
                      Resolved
                    </Button>
                    <Button
                      onClick={() => this.onOpenInMeldWindow(file.path)}
                      className="button-primary"
                    >
                      Open in Meld Window
                    </Button>
                  </div>
                )}
              </Row>
            )
          })}
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText="Close"
            onOkButtonClick={this.props.onDismissed}
            onCancelButtonClick={this.props.onDismissed}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
