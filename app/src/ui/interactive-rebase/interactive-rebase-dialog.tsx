import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { Commit } from '../../models/commit'
import { getCommits } from '../../lib/git/log'
import { rebaseInteractive } from '../../lib/git/rebase'
import { Ref } from '../lib/ref'
import { Row } from '../lib/row'
import { Select } from '../lib/select'
import { Button } from '../lib/button'
import * as Path from 'path'
import * as Fs from 'fs/promises'

interface IInteractiveRebaseDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly branchName: string
  readonly onDismissed: () => void
}

interface ICommitAction {
  readonly sha: string
  readonly summary: string
  readonly action: 'pick' | 'reword' | 'squash' | 'fixup' | 'drop'
}

interface IInteractiveRebaseDialogState {
  readonly commits: ReadonlyArray<ICommitAction>
  readonly loading: boolean
  readonly rebasing: boolean
}

const actions = ['pick', 'reword', 'squash', 'fixup', 'drop']

export class InteractiveRebaseDialog extends React.Component<
  IInteractiveRebaseDialogProps,
  IInteractiveRebaseDialogState
> {
  public constructor(props: IInteractiveRebaseDialogProps) {
    super(props)
    this.state = { commits: [], loading: true, rebasing: false }
  }

  public async componentDidMount() {
    const commits = await getCommits(this.props.repository, this.props.branchName, 100)
    this.setState({
      commits: commits.map(c => ({
        sha: c.sha,
        summary: c.summary,
        action: 'pick',
      })),
      loading: false,
    })
  }

  private onActionChange = (sha: string, event: React.FormEvent<HTMLSelectElement>) => {
    const action = event.currentTarget.value as ICommitAction['action']
    this.setState(prev => ({
      commits: prev.commits.map(c =>
        c.sha === sha ? { ...c, action } : c
      ),
    }))
  }

  private onMoveUp = (index: number) => {
    if (index === 0) return
    this.setState(prev => {
      const commits = [...prev.commits]
      const temp = commits[index]
      commits[index] = commits[index - 1]
      commits[index - 1] = temp
      return { commits }
    })
  }

  private onMoveDown = (index: number) => {
    this.setState(prev => {
      if (index >= prev.commits.length - 1) return prev
      const commits = [...prev.commits]
      const temp = commits[index]
      commits[index] = commits[index + 1]
      commits[index + 1] = temp
      return { commits }
    })
  }

  private onStartRebase = async () => {
    const { repository, branchName } = this.props
    const { commits } = this.state

    this.setState({ rebasing: true })

    try {
      const todoLines = commits
        .filter(c => c.action !== 'drop')
        .map(c => `${c.action} ${c.sha} ${c.summary}`)

      const todoPath = Path.join(repository.path, '.git', 'rebase-todo.txt')
      await Fs.writeFile(todoPath, todoLines.join('\n'), 'utf-8')

      await rebaseInteractive(repository, todoPath, `${branchName}~${commits.length}`)

      this.props.onDismissed()
    } catch (err) {
      this.setState({ rebasing: false })
    }
  }

  public render() {
    const { commits, loading, rebasing } = this.state

    return (
      <Dialog
        id="interactive-rebase"
        title={__DARWIN__ ? 'Interactive Rebase' : 'Interactive rebase'}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onStartRebase}
        loading={rebasing}
      >
        <DialogContent>
          {loading && <Row>Loading commits…</Row>}
          {!loading && commits.length === 0 && (
            <Row>No commits to rebase.</Row>
          )}
          {!loading &&
            commits.map((commit, index) => (
              <Row key={commit.sha} className="rebase-commit">
                <Select
                  value={commit.action}
                  onChange={(e) => this.onActionChange(commit.sha, e)}
                >
                  {actions.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Select>
                <span className="rebase-sha"><Ref>{commit.sha.substring(0, 7)}</Ref></span>{' '}
                <span className="rebase-summary"><Ref>{commit.summary}</Ref></span>
                <Button onClick={() => this.onMoveUp(index)} disabled={index === 0}>↑</Button>
                <Button onClick={() => this.onMoveDown(index)} disabled={index === commits.length - 1}>↓</Button>
              </Row>
            ))}
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={rebasing ? 'Rebasing…' : 'Start Rebase'}
            okButtonDisabled={rebasing}
            onCancelButtonClick={this.props.onDismissed}
            onOkButtonClick={this.onStartRebase}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
