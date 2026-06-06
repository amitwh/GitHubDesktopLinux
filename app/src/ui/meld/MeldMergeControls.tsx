import * as React from 'react'

export interface IMeldMergeControlsProps {
  readonly hasUnresolvedConflicts: boolean
  readonly onAutoMerge: () => void
  readonly onMarkResolved: () => void
}

/**
 * Small action toolbar for Phase 1c three-way merge view.
 *
 * Sits between/around the 3-way and merged panes and provides two buttons:
 *   - "Auto-merge" — runs `git merge-file` via the dispatcher
 *   - "Mark as resolved" — writes the merged content + stages the file
 */
export function MeldMergeControls({
  hasUnresolvedConflicts,
  onAutoMerge,
  onMarkResolved,
}: IMeldMergeControlsProps) {
  return (
    <div
      className="meld-merge-controls"
      role="toolbar"
      aria-label="Merge actions"
    >
      <button
        type="button"
        onClick={onAutoMerge}
        data-testid="meld-merge-controls-auto-merge"
        aria-label="Run automatic merge using git merge-file"
      >
        Auto-merge
      </button>
      <button
        type="button"
        onClick={onMarkResolved}
        disabled={hasUnresolvedConflicts}
        data-testid="meld-merge-controls-mark-resolved"
        aria-label="Mark file as resolved and stage it"
        aria-disabled={hasUnresolvedConflicts}
      >
        Mark as resolved
      </button>
    </div>
  )
}
