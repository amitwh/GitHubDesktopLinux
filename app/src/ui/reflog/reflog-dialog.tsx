import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Repository } from '../../models/repository'
import { IReflogEntry, getReflog } from '../../lib/git/reflog'
import { Ref } from '../lib/ref'
import { Row } from '../lib/row'
import { Button } from '../lib/button'
import { Dispatcher } from '../dispatcher'

interface IReflogDialogProps {
  readonly repository: Repository
  readonly onDismissed: () => void
  /**
   * Phase 2 (T2, ReflogWiring): dispatcher used to open the Meld
   * window for the commit referenced by a reflog entry. Optional
   * for backward compatibility with existing tests that mount
   * the dialog without a dispatcher; when omitted, the per-row
   * "Open in Meld" button is hidden.
   */
  readonly dispatcher?: Dispatcher
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

  /**
   * Phase 2 (T2, ReflogWiring): open the Meld window for the
   * commit referenced by a reflog entry. Delegates to the
   * dispatcher's `openReflogInMeld` helper so the dialog stays
   * free of Meld-specific knowledge.
   */
  private onOpenInMeld = (event: React.MouseEvent<HTMLButtonElement>) => {
    const sha = event.currentTarget.getAttribute('data-reflog-sha')
    if (sha === null || this.props.dispatcher === undefined) {
      return
    }
    void this.props.dispatcher.openReflogInMeld(this.props.repository, sha)
  }

  public render() {
    const { entries, loading } = this.state
    const showOpenInMeld = this.props.dispatcher !== undefined

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
                </span>{' '}
                {showOpenInMeld && (
                  <Button
                    onClick={this.onOpenInMeld}
                    data-reflog-sha={entry.sha}
                    className="reflog-open-in-meld"
                  >
                    Open in Meld
                  </Button>
                )}
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