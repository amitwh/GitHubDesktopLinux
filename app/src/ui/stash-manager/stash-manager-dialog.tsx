import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Repository } from '../../models/repository'
import {
  getAllStashes,
  dropStashByName,
  IAllStashEntry,
} from '../../lib/git/stash'
import { Ref } from '../lib/ref'
import { Row } from '../lib/row'
import { Button } from '../lib/button'

interface IStashManagerDialogProps {
  readonly repository: Repository
  readonly onDismissed: () => void
}

interface IStashManagerDialogState {
  readonly entries: ReadonlyArray<IAllStashEntry>
  readonly loading: boolean
}

export class StashManagerDialog extends React.Component<
  IStashManagerDialogProps,
  IStashManagerDialogState
> {
  public constructor(props: IStashManagerDialogProps) {
    super(props)
    this.state = { entries: [], loading: true }
  }

  public async componentDidMount() {
    await this.loadStashes()
  }

  private loadStashes = async () => {
    const entries = await getAllStashes(this.props.repository)
    this.setState({ entries, loading: false })
  }

  private onDrop = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const stashName = event.currentTarget.getAttribute('data-stash-name')
    if (stashName === null) {
      return
    }
    await dropStashByName(this.props.repository, stashName)
    await this.loadStashes()
  }

  public render() {
    const { entries, loading } = this.state

    return (
      <Dialog
        id="stash-manager"
        title={__DARWIN__ ? 'Stashes' : 'Stashes'}
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          {loading && <Row>Loading stashes…</Row>}
          {!loading && entries.length === 0 && <Row>No stashes found.</Row>}
          {!loading &&
            entries.map(entry => (
              <Row key={entry.name} className="stash-entry">
                <span className="stash-name">
                  <Ref>{entry.name}</Ref>
                </span>{' '}
                <span className="stash-sha">
                  <Ref>{entry.stashSha.substring(0, 7)}</Ref>
                </span>{' '}
                <span className="stash-message">
                  <Ref>{entry.message}</Ref>
                </span>{' '}
                <Button onClick={this.onDrop} data-stash-name={entry.name}>
                  Drop
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
