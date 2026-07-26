import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { RadioGroup } from '../lib/radio-group'
import { GitResetMode } from '../../lib/git'
import { Commit } from '../../models/commit'

interface IResetModeDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly commit: Commit
  readonly onDismissed: () => void
}

interface IResetModeDialogState {
  readonly mode: GitResetMode
  readonly isLoading: boolean
}

/**
 * Dialog that lets the user pick a `git reset` mode (Soft, Mixed, or Hard)
 * before applying a "Reset to commit" against a non-HEAD commit.
 *
 * NOTE: This component is intentionally not mounted yet. The current
 * Repository menu implementation drives the mode directly through
 * `reset-head-{soft,mixed,hard}` events (no dialog), and the commit-list
 * context menu still routes through the existing `WarningBeforeReset`
 * confirmation flow. Wiring this dialog into either surface is left to a
 * follow-up so the scope of Stage 3A stays small. The dialog is otherwise
 * complete and self-contained; once a parent renders it, the "Continue"
 * button dispatches `dispatcher.resetToCommit` with the chosen mode and
 * `showConfirmationDialog = false` since the user has already confirmed
 * the mode choice here.
 */
export class ResetModeDialog extends React.Component<
  IResetModeDialogProps,
  IResetModeDialogState
> {
  public constructor(props: IResetModeDialogProps) {
    super(props)
    this.state = {
      mode: GitResetMode.Mixed,
      isLoading: false,
    }
  }

  public render() {
    const title = __DARWIN__ ? 'Reset to Commit' : 'Reset to commit'

    return (
      <Dialog
        id="reset-mode-dialog"
        type="warning"
        title={title}
        loading={this.state.isLoading}
        disabled={this.state.isLoading}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
        role="alertdialog"
        ariaDescribedBy="reset-mode-message"
      >
        <DialogContent>
          <p id="reset-mode-message">
            Choose how {this.props.commit.sha.slice(0, 7)} should be reset.
            This action rewrites branch history — coordinate with collaborators
            before pushing.
          </p>
          <RadioGroup<GitResetMode>
            ariaLabelledBy="reset-mode-message"
            selectedKey={this.state.mode}
            radioButtonKeys={[
              GitResetMode.Soft,
              GitResetMode.Mixed,
              GitResetMode.Hard,
            ]}
            onSelectionChanged={this.onSelectionChanged}
            renderRadioButtonLabelContents={this.renderModeLabel}
          />
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            destructive={this.state.mode === GitResetMode.Hard}
            okButtonText={__DARWIN__ ? 'Reset' : '&Reset'}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onSelectionChanged = (mode: GitResetMode) => {
    this.setState({ mode })
  }

  private renderModeLabel = (mode: GitResetMode): JSX.Element => {
    switch (mode) {
      case GitResetMode.Soft:
        return (
          <>
            <strong>Soft</strong> — keep all changes staged for commit.
          </>
        )
      case GitResetMode.Mixed:
        return (
          <>
            <strong>Mixed</strong> — keep changes in working tree, unstaged.
          </>
        )
      case GitResetMode.Hard:
        return (
          <>
            <strong>Hard</strong> — discard all working tree changes
            (destructive).
          </>
        )
      default:
        return <>{String(mode)}</>
    }
  }

  private onSubmit = async () => {
    const { dispatcher, repository, commit, onDismissed } = this.props
    this.setState({ isLoading: true })

    try {
      // `showConfirmationDialog = false` because the user already confirmed
      // the destructive intent by clicking "Reset" in this dialog.
      await dispatcher.resetToCommit(repository, commit, this.state.mode, false)
    } finally {
      this.setState({ isLoading: false })
    }

    onDismissed()
  }
}
