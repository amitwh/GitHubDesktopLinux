import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { IReflogEntry, getReflog } from '../../lib/git/reflog'
import { Ref } from '../lib/ref'
import { Row } from '../lib/row'

interface IReflogDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly onDismissed: () => void
}

interface IReflogDialogState {
  readonly entries: ReadonlyArray<IReflogEntry>
  readonly loading: boolean
}

export class ReflogDialog extends React.Component<
  IReflogDialogProps,
  IReflogDialogState
> {
  public constructor(props: IReflogDialogProps) {
    super(props)
    this.state = { entries: [], loading: true }
  }

  public async componentDidMount() {
    const entries = await getReflog(this.props.repository)
    this.setState({ entries, loading: false })
  }

  public render() {
    const { entries, loading } = this.state

    return (
      <Dialog
        id="reflog"
        title={__DARWIN__ ? 'RefLog' : 'RefLog'}
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          {loading && <Row>Loading…</Row>}
          {!loading && entries.length === 0 && (
            <Row>No reflog entries found.</Row>
          )}
          {!loading &&
            entries.map(entry => (
              <Row key={entry.reflogName} className="reflog-entry">
                <span className="reflog-sha"><Ref>{entry.sha.substring(0, 7)}</Ref></span>{' '}
                <span className="reflog-subject"><Ref>{entry.subject}</Ref></span>{' '}
                <span className="reflog-meta">
                  <Ref>{entry.author} · {entry.timestamp.toLocaleString()}</Ref>
                </span>
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
