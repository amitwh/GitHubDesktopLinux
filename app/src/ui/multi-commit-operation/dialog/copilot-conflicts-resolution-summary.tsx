import * as React from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

import { ICopilotResolutionSummary } from '../../../lib/copilot-conflict-resolution'
import { MultiCommitOperationKind } from '../../../models/multi-commit-operation'
import { PullRequest } from '../../../models/pull-request'
import { Commit } from '../../../models/commit'
import { LinkButton } from '../../lib/link-button'
import { TooltippedCommitSHA } from '../../lib/tooltipped-commit-sha'
import { Octicon } from '../../octicons'
import * as octicons from '../../octicons/octicons.generated'

interface ICopilotConflictsResolutionSummaryProps {
  readonly summary: ICopilotResolutionSummary
  readonly operationKind: MultiCommitOperationKind
}

/**
 * Returns the title-bar text describing the operation as a complete
 * sentence — e.g. "Merging Feature-A into Feature-B" — using only words
 * (no arrows). Renders directly into the card's h2.
 */
function getOperationTitle(
  kind: MultiCommitOperationKind,
  ourLabel: string,
  theirLabel: string
): string {
  switch (kind) {
    case MultiCommitOperationKind.Merge:
      return `Merging ${theirLabel} into ${ourLabel}`
    case MultiCommitOperationKind.Rebase:
      return `Rebasing ${ourLabel} onto ${theirLabel}`
    case MultiCommitOperationKind.CherryPick:
      return `Cherry-picking from ${theirLabel} into ${ourLabel}`
    case MultiCommitOperationKind.Squash:
      return `Squashing into ${ourLabel}`
    case MultiCommitOperationKind.Reorder:
      return `Reordering ${ourLabel}`
    default:
      return `Resolving conflicts in ${ourLabel}`
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
 * Pattern matching commit summaries that carry no useful human context —
 * checkpoint commits, fixups, in-progress markers, single-character
 * placeholders, etc. Any commit matching this is dropped from the "For
 * more context" block since it would only add noise.
 */
const lowSignalCommitPattern =
  /^(?:wip\b|work in progress\b|fixup!?\b|squash!?\b|amend\b|temp\b|tmp\b|draft\b|debug\b|todo\b|asdf+|test+|\.+|-+|x+)$/i

function isLowSignalCommit(commit: Commit): boolean {
  const summary = commit.summary.trim()
  if (summary.length < 5) {
    return true
  }
  return lowSignalCommitPattern.test(summary)
}

/**
 * The Copilot resolution summary card rendered at the top of the conflict
 * resolution dialog. Combines a deterministic title, the model-authored
 * markdown body, and a Desktop-rendered references block with real links
 * to PRs and commits.
 */
export class CopilotConflictsResolutionSummary extends React.Component<ICopilotConflictsResolutionSummaryProps> {
  public render() {
    const { summary, operationKind } = this.props
    const title = getOperationTitle(
      operationKind,
      summary.ourLabel,
      summary.theirLabel
    )

    return (
      <section
        className="copilot-conflicts-summary"
        aria-label="Resolution summary"
      >
        <h2 className="copilot-conflicts-summary-title">{title}</h2>
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
    const ourCommits = summary.ourCommits.filter(c => !isLowSignalCommit(c))
    const theirCommits = summary.theirCommits.filter(c => !isLowSignalCommit(c))

    const hasPullRequests = allPullRequests.length > 0
    const hasOurCommits = ourCommits.length > 0
    const hasTheirCommits = theirCommits.length > 0

    if (!hasPullRequests && !hasOurCommits && !hasTheirCommits) {
      return null
    }

    return (
      <div className="copilot-conflicts-summary-references">
        <h3 className="copilot-conflicts-summary-references-title">
          For more context
        </h3>

        {hasPullRequests && (
          <div className="copilot-conflicts-summary-references-section">
            <ul className="copilot-conflicts-summary-pr-list">
              {allPullRequests.map(pr => this.renderPullRequest(pr))}
            </ul>
          </div>
        )}

        {hasTheirCommits && (
          <div className="copilot-conflicts-summary-references-section">
            <h4 className="copilot-conflicts-summary-references-subtitle">
              Commits from {summary.theirLabel}
            </h4>
            {this.renderCommits(
              theirCommits,
              summary.theirPullRequests[0] ?? null
            )}
          </div>
        )}

        {hasOurCommits && (
          <div className="copilot-conflicts-summary-references-section">
            <h4 className="copilot-conflicts-summary-references-subtitle">
              Commits from {summary.ourLabel}
            </h4>
            {this.renderCommits(ourCommits, summary.ourPullRequest)}
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
    return (
      <ul className="copilot-conflicts-summary-commit-list">
        {commits.map(commit => {
          const url = getCommitUrl(commit, relatedPullRequest)
          const sha = (
            <TooltippedCommitSHA
              className="copilot-conflicts-summary-commit-sha"
              commit={commit}
            />
          )
          const message =
            url === null ? (
              <span className="copilot-conflicts-summary-commit-summary">
                {commit.summary}
              </span>
            ) : (
              <LinkButton
                uri={url}
                className="copilot-conflicts-summary-commit-summary"
              >
                {commit.summary}
              </LinkButton>
            )

          return (
            <li
              key={commit.sha}
              className="copilot-conflicts-summary-commit-item"
            >
              {sha}
              {message}
            </li>
          )
        })}
      </ul>
    )
  }
}
