import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Repository } from '../../models/repository'
import {
  getSubmodules,
  updateSubmodule,
  syncSubmodule,
  ISubmodule,
} from '../../lib/git/submodule'
import { Ref } from '../lib/ref'
import { Row } from '../lib/row'
import { Button } from '../lib/button'

interface ISubmoduleDialogProps {
  readonly repository: Repository
  readonly onDismissed: () => void
}

interface ISubmoduleDialogState {
  readonly submodules: ReadonlyArray<ISubmodule>
  readonly loading: boolean
}

export class SubmoduleDialog extends React.Component<
  ISubmoduleDialogProps,
  ISubmoduleDialogState
> {
  public constructor(props: ISubmoduleDialogProps) {
    super(props)
    this.state = { submodules: [], loading: true }
  }

  public async componentDidMount() {
    await this.loadSubmodules()
  }

  private loadSubmodules = async () => {
    const submodules = await getSubmodules(this.props.repository)
    this.setState({ submodules, loading: false })
  }

  private onUpdate = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const path = event.currentTarget.getAttribute('data-submodule-path')
    if (path === null) {
      return
    }
    await updateSubmodule(this.props.repository, path)
    await this.loadSubmodules()
  }

  private onReload = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const path = event.currentTarget.getAttribute('data-submodule-path')
    if (path === null) {
      return
    }
    await syncSubmodule(this.props.repository, path)
    await this.loadSubmodules()
  }

  public render() {
    const { submodules, loading } = this.state

    return (
      <Dialog
        id="submodule"
        title={__DARWIN__ ? 'Submodules' : 'Submodules'}
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          {loading && <Row>Loading submodules…</Row>}
          {!loading && submodules.length === 0 && (
            <Row>No submodules found.</Row>
          )}
          {!loading &&
            submodules.map(sub => (
              <Row key={sub.path} className="submodule-entry">
                <span className="submodule-sha">
                  <Ref>{sub.sha.substring(0, 7)}</Ref>
                </span>{' '}
                <span className="submodule-path">
                  <Ref>{sub.path}</Ref>
                </span>{' '}
                <Button onClick={this.onUpdate} data-submodule-path={sub.path}>
                  Update
                </Button>{' '}
                <Button onClick={this.onReload} data-submodule-path={sub.path}>
                  Sync
                </Button>
              </Row>
            ))}
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
