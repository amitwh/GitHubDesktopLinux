import * as React from 'react'
import { existsSync } from 'fs'
import {
  WorktreeEntry,
  getWorktreeDescription,
  getWorktreeDisplayName,
} from '../../models/worktree'
import { IMatches } from '../../lib/fuzzy-find'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { HighlightText } from '../lib/highlight-text'
import classNames from 'classnames'
import { TooltippedContent } from '../lib/tooltipped-content'
import { enableAccessibleListToolTips } from '../../lib/feature-flag'

interface IWorktreeListItemProps {
  readonly worktree: WorktreeEntry
  readonly isCurrentWorktree: boolean
  readonly matches: IMatches
  readonly sizeBytes?: number | null
}

/** Format a byte count as a short human-readable string (e.g. "1.2 MB"). */
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  // One decimal for KB+, no decimal for bytes.
  const display =
    unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${display} ${units[unitIndex]}`
}

export class WorktreeListItem extends React.Component<IWorktreeListItemProps> {
  public render() {
    const { worktree, isCurrentWorktree, matches, sizeBytes } = this.props
    const name = getWorktreeDisplayName(worktree)
    const description = getWorktreeDescription(worktree)
    const icon = isCurrentWorktree ? octicons.check : octicons.fileDirectory
    const className = classNames('worktrees-list-item', {
      'current-worktree': isCurrentWorktree,
    })

    // The `prunable` porcelain flag only appears after git's prune expiry;
    // existence-check is the responsive signal for a freshly-removed
    // folder, so we use it as the primary "stale" indicator.
    const folderExists = existsSync(worktree.path)
    const isStale = !folderExists

    const sizeText =
      sizeBytes === null || sizeBytes === undefined ? '—' : formatSize(sizeBytes)

    return (
      <div className={className}>
        <Octicon className="icon" symbol={icon} />
        <TooltippedContent
          className="name"
          tooltip={name}
          onlyWhenOverflowed={true}
          tagName="div"
          disabled={enableAccessibleListToolTips()}
        >
          <HighlightText text={name} highlight={matches.title} />
        </TooltippedContent>
        <TooltippedContent
          className="description"
          tooltip={worktree.branch ?? worktree.head}
          onlyWhenOverflowed={true}
          tagName="div"
          disabled={enableAccessibleListToolTips()}
        >
          {description}
        </TooltippedContent>
        <span className="badges" aria-label="worktree status">
          {worktree.isLocked ? (
            <span
              className="badge badge-locked"
              title="Locked — run 'git worktree unlock' from the context menu to remove."
            >
              <Octicon symbol={octicons.lock} />
              <span className="badge-text">Locked</span>
            </span>
          ) : null}
          {isStale ? (
            <span
              className="badge badge-stale"
              title="The worktree directory is missing on disk."
            >
              <Octicon symbol={octicons.alert} />
              <span className="badge-text">Stale — folder missing</span>
            </span>
          ) : null}
        </span>
        <span className="size" aria-label="disk usage">
          {sizeText}
        </span>
      </div>
    )
  }
}
