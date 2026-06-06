/**
 * Models for Phase 1b of the Meld-style diff viewer: editable panes
 * with per-hunk copy and char-level diff highlighting.
 *
 * See `docs/superpowers/specs/2026-06-05-meld-style-diff-viewer-design.md`
 * (Phase 1b section) for the spec these types implement.
 */

/**
 * A single hunk's line range in a unified diff. Lines are 0-indexed and
 * the ranges are inclusive on both ends. A hunk with no `old*` lines
 * (e.g. an addition) has `oldStartLine === oldEndLine === newStartLine`
 * pointing at the insertion point.
 */
export interface IMeldEditHunk {
  readonly oldStartLine: number
  readonly oldEndLine: number
  readonly newStartLine: number
  readonly newEndLine: number
}

/**
 * In-memory snapshot of what the user is currently editing in the two
 * panes. `*Content` is the live (possibly modified) text, `*Original`
 * is the text at load time used to compute `hasChanges` and to revert
 * when the user clicks Discard.
 */
export interface IMeldEditState {
  readonly leftContent: string
  readonly rightContent: string
  readonly leftOriginal: string
  readonly rightOriginal: string
  readonly hasChanges: boolean
}

/**
 * A live editing session for a single (repository, file) pair. The
 * `mode` determines which side of the diff is editable:
 *   - 'working' — right pane is the working tree, left is HEAD
 *   - 'commit'  — right pane is the commit, left is the parent
 *   - 'merge'   — three-way; base + ours + theirs (base is added later)
 */
export interface IMeldEditSession {
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: 'working' | 'commit' | 'merge'
  readonly edits: IMeldEditState
}
