import * as React from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

import { ICopilotResolutionSummary } from '../../../lib/copilot-conflict-resolution'
import { MultiCommitOperationKind } from '../../../models/multi-commit-operation'
import { PullRequest } from '../../../models/pull-request'
import { Commit } from '../../../models/commit'
import { LinkButton } from '../../lib/link-button'
import { Octicon } from '../../octicons'
import * as octicons from '../../octicons/octicons.generated'

interface ICopilotConflictsResolutionSummaryProps {
  readonly summary: ICopilotResolutionSummary
  readonly operationKind: MultiCommitOperationKind
}

/**
 * Returns the verb describing how the *theirs* side is being applied to the
 * *ours* side, given the multi-commit operation kind. Used to anchor the
 * branch-flow header at the top of the resolution summary card.
 */
function getOperationVerb(kind: MultiCommitOperationKind): string {
  switch (kind) {
    case MultiCommitOperationKind.Merge:
      return 'Merging'
    case MultiCommitOperationKind.Rebase:
      return 'Rebasing onto'
    case MultiCommitOperationKind.CherryPick:
      return 'Cherry-picking from'
    case MultiCommitOperationKind.Squash:
      return 'Squashing'
    case MultiCommitOperationKind.Reorder:
      return 'Reordering'
    default:
      return 'Resolving'
  }
}

/**
 * Renders Copilot-authored markdown as a sanitized HTML fragment. The model
 * is instructed to never emit URLs (it uses `#1234` / `abc1234` ids only)
 * so we can safely sanitize without needing iframe isolation.
 */
function renderMarkdown(markdown: string): string {
  const parsed = marked.parse(markdown) as string
  return DOMPurify.sanitize(parsed, {
    USE_PROFILES: { html: true },
    // Strip anchors entirely — Desktop owns links in the references block.
    FORBID_TAGS: ['a', 'img', 'script', 'style', 'iframe'],
  })
}

function getPullRequestUrl(pr: PullRequest): string | null {
  const repo = pr.head.gitHubRepository
  return repo === null ? null : `${repo.htmlURL}/pull/${pr.pullRequestNumber}`
}

function getCommitUrl(commit: Commit, pr: PullRequest | null): string | null {
  // Prefer the PR's repo since the commit doesn't carry a repo reference.
  // Fall back to nothing — without a known repo we cannot link.
  const repo = pr?.head.gitHubRepository ?? null
  return repo === null ? null : `${repo.htmlURL}/commit/${commit.sha}`
}

/**
 * The Copilot resolution summary card rendered at the top of the conflict
 * resolution dialog. Combines a deterministic branch-flow header, the
 * model-authored markdown body, and a Desktop-rendered references block
 * with real links to PRs and commits.
 */
export class CopilotConflictsResolutionSummary extends React.Component<ICopilotConflictsResolutionSummaryProps> {
  public render() {
    const { summary, operationKind } = this.props
    const verb = getOperationVerb(operationKind)

    return (
      <section
        className="copilot-conflicts-summary"
        aria-label="Resolution summary"
      >
        <header className="copilot-conflicts-summary-header">
          <span className="copilot-conflicts-summary-verb">{verb}</span>
          <span className="copilot-conflicts-summary-ref">
            {summary.theirLabel}
          </span>
          <Octicon
            symbol={octicons.arrowRight}
            className="copilot-conflicts-summary-arrow"
          />
          <span className="copilot-conflicts-summary-ref">
            {summary.ourLabel}
          </span>
        </header>

        {this.renderMarkdownBody()}
        {this.renderReferences()}
      </section>
    )
  }

  private renderMarkdownBody(): JSX.Element | null {
    const { markdown } = this.props.summary
    if (markdown === null || markdown.trim() === '') {
      return null
    }

    const html = renderMarkdown(markdown)

    return (
      <div className="copilot-conflicts-summary-body">
        <div className="copilot-conflicts-summary-attribution">
          <Octicon
            symbol={octicons.copilot}
            className="copilot-conflicts-summary-copilot-icon"
          />
          <span>Resolution summary by Copilot</span>
        </div>
        <div
          className="copilot-conflicts-summary-markdown"
          // Sanitized via DOMPurify above; safe to inject as HTML.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    )
  }

  private renderReferences(): JSX.Element | null {
    const { summary } = this.props
    const allPullRequests = [
      ...(summary.ourPullRequest === null ? [] : [summary.ourPullRequest]),
      ...summary.theirPullRequests,
    ]
    const hasPullRequests = allPullRequests.length > 0
    const hasOurCommits = summary.ourCommits.length > 0
    const hasTheirCommits = summary.theirCommits.length > 0

    if (!hasPullRequests && !hasOurCommits && !hasTheirCommits) {
      return null
    }

    return (
      <div className="copilot-conflicts-summary-references">
        <h4 className="copilot-conflicts-summary-references-title">
          For more context
        </h4>

        {hasPullRequests && (
          <div className="copilot-conflicts-summary-references-section">
            <ul className="copilot-conflicts-summary-pr-list">
              {allPullRequests.map(pr => this.renderPullRequest(pr))}
            </ul>
          </div>
        )}

        {hasTheirCommits && (
          <div className="copilot-conflicts-summary-references-section">
            <h5 className="copilot-conflicts-summary-references-subtitle">
              Commits from {summary.theirLabel}
            </h5>
            {this.renderCommits(
              summary.theirCommits,
              summary.theirPullRequests[0] ?? null
            )}
          </div>
        )}

        {hasOurCommits && (
          <div className="copilot-conflicts-summary-references-section">
            <h5 className="copilot-conflicts-summary-references-subtitle">
              Commits from {summary.ourLabel}
            </h5>
            {this.renderCommits(summary.ourCommits, summary.ourPullRequest)}
          </div>
        )}
      </div>
    )
  }

  private renderPullRequest(pr: PullRequest): JSX.Element {
    const url = getPullRequestUrl(pr)
    const label = (
      <>
        <Octicon
          symbol={octicons.gitPullRequest}
          className="copilot-conflicts-summary-pr-icon"
        />
        <span className="copilot-conflicts-summary-pr-number">
          #{pr.pullRequestNumber}
        </span>
        <span className="copilot-conflicts-summary-pr-title">{pr.title}</span>
      </>
    )

    return (
      <li
        key={pr.pullRequestNumber}
        className="copilot-conflicts-summary-pr-item"
      >
        {url === null ? (
          <span className="copilot-conflicts-summary-pr-link">{label}</span>
        ) : (
          <LinkButton uri={url} className="copilot-conflicts-summary-pr-link">
            {label}
          </LinkButton>
        )}
      </li>
    )
  }

  private renderCommits(
    commits: ReadonlyArray<Commit>,
    relatedPullRequest: PullRequest | null
  ): JSX.Element {
    // Cap at a small number — the references block is meant to be a glance,
    // not an exhaustive log. The model already saw all of them in the prompt.
    const visible = commits.slice(0, 5)

    return (
      <ul className="copilot-conflicts-summary-commit-list">
        {visible.map(commit => {
          const url = getCommitUrl(commit, relatedPullRequest)
          const label = (
            <>
              <code className="copilot-conflicts-summary-commit-sha">
                {commit.shortSha}
              </code>
              <span className="copilot-conflicts-summary-commit-summary">
                {commit.summary}
              </span>
            </>
          )

          return (
            <li
              key={commit.sha}
              className="copilot-conflicts-summary-commit-item"
            >
              {url === null ? (
                <span className="copilot-conflicts-summary-commit-link">
                  {label}
                </span>
              ) : (
                <LinkButton
                  uri={url}
                  className="copilot-conflicts-summary-commit-link"
                >
                  {label}
                </LinkButton>
              )}
            </li>
          )
        })}
      </ul>
    )
  }
}
