import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { getBlame, IBlameHunk } from '../../lib/git/blame'
import { Ref } from '../lib/ref'
import { Row } from '../lib/row'

interface IBlameDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly relativePath: string
  readonly onDismissed: () => void
}

interface IBlameDialogState {
  readonly hunks: ReadonlyArray<IBlameHunk>
  readonly loading: boolean
}

export class BlameDialog extends React.Component<
  IBlameDialogProps,
  IBlameDialogState
> {
  public constructor(props: IBlameDialogProps) {
    super(props)
    this.state = { hunks: [], loading: true }
  }

  public async componentDidMount() {
    const hunks = await getBlame(this.props.repository, this.props.relativePath)
    this.setState({ hunks, loading: false })
  }

  public render() {
    const { hunks, loading } = this.state
    const fileName = this.props.relativePath

    return (
      <Dialog
        id="blame"
        title={`Blame: ${fileName}`}
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          {loading && <Row>Loading blame…</Row>}
          {!loading && hunks.length === 0 && (
            <Row>No blame information available.</Row>
          )}
          {!loading &&
            hunks.map(hunk => (
              <Row key={`${hunk.sha}-${hunk.startLine}`} className="blame-hunk">
                <Ref className="blame-sha">{hunk.sha.substring(0, 7)}</Ref>{' '}
                <Ref className="blame-author">{hunk.author}</Ref>{' '}
                <Ref className="blame-summary">{hunk.summary}</Ref>{' '}
                <Ref className="blame-lines">
                  lines {hunk.startLine + 1}–{hunk.startLine + hunk.lineCount}
                </Ref>
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
