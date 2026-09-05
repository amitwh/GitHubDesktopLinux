import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Repository } from '../../models/repository'
import { getCommits } from '../../lib/git/log'
import { rebaseInteractive } from '../../lib/git/rebase'
import { Ref } from '../lib/ref'
import { Row } from '../lib/row'
import { Select } from '../lib/select'
import { Button } from '../lib/button'
import * as Path from 'path'
import * as Fs from 'fs/promises'
import { MeldRebasePreview } from '../meld/MeldRebasePreview'
import { IRebaseCommitStats } from '../../lib/meld/rebasePreview'

interface IInteractiveRebaseDialogProps {
  readonly repository: Repository
  readonly branchName: string
  readonly onDismissed: () => void

  /**
   * Phase 3 (MeldRebasePreview): aggregate shortstat results keyed
   * by commit SHA. The parent populates this after calling
   * `meld:get-rebase-commit-stats`. When omitted, the preview still
   * mounts but shows "Loading stats…" indicators for every row.
   */
  readonly stats?: { readonly [sha: string]: IRebaseCommitStats | undefined }

  /**
   * Phase 3: per-commit loading flag set, keyed by SHA. The parent
   * can flip a SHA's flag to `true` while a stats fetch is in flight.
   */
  readonly loading?: { readonly [sha: string]: boolean | undefined }

  /**
   * Phase 3: invoked when the user clicks a commit row's "View diff"
   * button. The parent should open a Meld window in commit mode for
   * the given SHA.
   */
  readonly onViewDiff?: (sha: string) => void
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
    const commits = await getCommits(
      this.props.repository,
      this.props.branchName,
      100
    )
    this.setState({
      commits: commits.map(c => ({
        sha: c.sha,
        summary: c.summary,
        action: 'pick',
      })),
      loading: false,
    })
  }

  private onActionChange = (event: React.FormEvent<HTMLSelectElement>) => {
    const sha = event.currentTarget.getAttribute('data-sha')
    if (sha === null) {
      return
    }
    const action = event.currentTarget.value as ICommitAction['action']
    this.setState(prev => ({
      commits: prev.commits.map(c => (c.sha === sha ? { ...c, action } : c)),
    }))
  }

  private onMoveUp = (event: React.MouseEvent<HTMLButtonElement>) => {
    const index = Number(event.currentTarget.getAttribute('data-index'))
    if (Number.isNaN(index) || index === 0) {
      return
    }
    this.setState(prev => {
      const commits = [...prev.commits]
      const temp = commits[index]
      commits[index] = commits[index - 1]
      commits[index - 1] = temp
      return { commits }
    })
  }

  private onMoveDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    const index = Number(event.currentTarget.getAttribute('data-index'))
    if (Number.isNaN(index)) {
      return
    }
    this.setState(prev => {
      if (index >= prev.commits.length - 1) {
        return prev
      }
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

      await rebaseInteractive(
        repository,
        todoPath,
        `${branchName}~${commits.length}`
      )

      this.props.onDismissed()
    } catch (err) {
      this.setState({ rebasing: false })
    }
  }

  private onViewDiff = (sha: string) => {
    if (this.props.onViewDiff) {
      this.props.onViewDiff(sha)
    }
  }

  private isDropped = (sha: string): boolean => {
    const commit = this.state.commits.find(c => c.sha === sha)
    return commit !== undefined && commit.action === 'drop'
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
          {!loading && commits.length === 0 && <Row>No commits to rebase.</Row>}
          {!loading &&
            commits.map((commit, index) => (
              <Row key={commit.sha} className="rebase-commit">
                <Select
                  value={commit.action}
                  onChange={this.onActionChange}
                  data-sha={commit.sha}
                >
                  {actions.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
                <span className="rebase-sha">
                  <Ref>{commit.sha.substring(0, 7)}</Ref>
                </span>{' '}
                <span className="rebase-summary">
                  <Ref>{commit.summary}</Ref>
                </span>
                <Button
                  onClick={this.onMoveUp}
                  data-index={index}
                  disabled={index === 0}
                >
                  ↑
                </Button>
                <Button
                  onClick={this.onMoveDown}
                  data-index={index}
                  disabled={index === commits.length - 1}
                >
                  ↓
                </Button>
              </Row>
            ))}
          {/* Phase 3: per-commit diff preview (insertions/deletions
              stats + "View diff" link). Reuses MeldRebasePreview. The
              preview re-renders live as the user reorders the rows
              above (the same `commits` state is fed in), so squash,
              reword, fixup and drop all reflect immediately. */}
          {!loading && commits.length > 0 && (
            <Row className="rebase-preview-row">
              <MeldRebasePreview
                commits={commits.map(c => ({
                  sha: c.sha,
                  summary: c.summary,
                }))}
                stats={this.props.stats ?? {}}
                loading={this.props.loading}
                isDropped={this.isDropped}
                onViewDiff={this.onViewDiff}
              />
            </Row>
          )}
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
