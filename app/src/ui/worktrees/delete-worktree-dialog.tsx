import * as React from 'react'
import * as Path from 'path'

import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Ref } from '../lib/ref'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Repository } from '../../models/repository'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import type { WorktreeDirtyState } from '../../lib/git/worktree'

interface IDeleteWorktreeDialogProps {
  readonly repository: Repository
  readonly worktreePath: string
  readonly askForConfirmationOnWorktreeRemoval: boolean
  readonly dirtyState?: WorktreeDirtyState
  readonly onDeleteWorktree: (
    repository: Repository,
    worktreePath: string,
    force?: boolean
  ) => Promise<void>
  readonly onConfirmWorktreeRemovalChanged: (value: boolean) => void
  readonly onDismissed: () => void
}

interface IDeleteWorktreeDialogState {
  readonly isDeleting: boolean
  readonly confirmWorktreeRemoval: boolean
  readonly forceConfirm: boolean
}

export class DeleteWorktreeDialog extends React.Component<
  IDeleteWorktreeDialogProps,
  IDeleteWorktreeDialogState
> {
  public constructor(props: IDeleteWorktreeDialogProps) {
    super(props)

    const ds = props.dirtyState ?? { modifiedCount: 0, untrackedCount: 0 }
    const isDirty = ds.modifiedCount > 0 || ds.untrackedCount > 0

    this.state = {
      isDeleting: false,
      confirmWorktreeRemoval: props.askForConfirmationOnWorktreeRemoval,
      forceConfirm: !isDirty,
    }
  }

  public componentDidUpdate(prevProps: IDeleteWorktreeDialogProps) {
    // If the dirty state arrives asynchronously, reset forceConfirm to
    // false so the user is forced to acknowledge dirty worktrees.
    if (prevProps.dirtyState === undefined && this.props.dirtyState !== undefined) {
      const ds = this.props.dirtyState
      const isDirty =
        (ds?.modifiedCount ?? 0) > 0 || (ds?.untrackedCount ?? 0) > 0
      if (isDirty) {
        this.setState({ forceConfirm: false })
      }
    }
  }

  public render() {
    const name = Path.basename(this.props.worktreePath)
    const ds = this.props.dirtyState ?? { modifiedCount: 0, untrackedCount: 0 }
    const isDirty = ds.modifiedCount > 0 || ds.untrackedCount > 0

    return (
      <Dialog
        id="delete-worktree"
        title={__DARWIN__ ? 'Delete Worktree' : 'Delete worktree'}
        type="warning"
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
        disabled={this.state.isDeleting || (isDirty && !this.state.forceConfirm)}
        loading={this.state.isDeleting}
        role="alertdialog"
        ariaDescribedBy="delete-worktree-confirmation"
      >
        <DialogContent>
          <p id="delete-worktree-confirmation">
            Are you sure you want to delete the worktree <Ref>{name}</Ref>?
          </p>
          {isDirty ? (
            <p className="dirty-warning" role="note">
              This worktree has {ds.modifiedCount} modified and{' '}
              {ds.untrackedCount} untracked files. Deleting the worktree
              directory is irreversible — any uncommitted changes will be lost.
            </p>
          ) : null}
          {isDirty ? (
            <Checkbox
              label="I understand that uncommitted changes will be lost"
              value={
                this.state.forceConfirm
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onForceConfirmChanged}
            />
          ) : null}
          <Checkbox
            label="Do not show this message again"
            value={
              this.state.confirmWorktreeRemoval
                ? CheckboxValue.Off
                : CheckboxValue.On
            }
            onChange={this.onConfirmWorktreeRemovalChanged}
          />
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup destructive={true} okButtonText="Delete" />
        </DialogFooter>
      </Dialog>
    )
  }

  private onForceConfirmChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.setState({ forceConfirm: event.currentTarget.checked })
  }

  private onConfirmWorktreeRemovalChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = !event.currentTarget.checked
    this.setState({ confirmWorktreeRemoval: value })
  }

  private onSubmit = async () => {
    this.setState({ isDeleting: true })

    this.props.onConfirmWorktreeRemovalChanged(
      this.state.confirmWorktreeRemoval
    )

    const ds = this.props.dirtyState ?? { modifiedCount: 0, untrackedCount: 0 }
    const isDirty = ds.modifiedCount > 0 || ds.untrackedCount > 0
    await this.props.onDeleteWorktree(
      this.props.repository,
      this.props.worktreePath,
      isDirty
    )
    this.props.onDismissed()
  }
}
