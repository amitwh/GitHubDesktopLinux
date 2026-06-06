/**
 * Models for Phase 1c of the Meld-style diff viewer: three-way merge
 * view (BASE / LOCAL / REMOTE) with user-editable MERGED pane and
 * per-hunk resolution actions.
 *
 * See `docs/superpowers/specs/2026-06-05-meld-style-diff-viewer-design.md`
 * (Phase 1c section) for the spec these types implement.
 */

/**
 * A single conflict block parsed from a git-style conflict-marker
 * region. `baseContent` is the common-ancestor text; `localContent`
 * and `remoteContent` are the two competing edits.
 */
export interface IConflictHunk {
  readonly baseContent: string
  readonly localContent: string
  readonly remoteContent: string
  /** 0-indexed line number in the MERGED file where the hunk starts. */
  readonly startLine: number
  /** Inclusive end line of the hunk (the line of `>>>>>>> ...`). */
  readonly endLine: number
  /**
   * The text that appears on the `||||||| <label>` line (the line
   * immediately after `<<<<<<< HEAD` in a 4-marker conflict block).
   * When this field is absent/undefined, the `|||||||` line was bare
   * (`|||||||` with no trailing text) and the base content appears
   * on the next line.
   *
   * Example: if the label line is `||||||| base`, then `baseLabel`
   * is the string `"base"`. If the label line is `||||||| merged`,
   * `baseLabel` is `"merged"`.
   *
   * This is needed to faithfully round-trip conflict markers.
   */
  readonly baseLabel?: string
  /**
   * The text that appears on the `>>>>>>> <label>` end marker line.
   * Example: `>>>>>>> branch` → `endLabel = "branch"`.
   * When absent, synthesised as `>>>>>>> HEAD` to match git default.
   */
  readonly endLabel?: string
}

/**
 * A three-way merge state for one (repository, file) pair. The three
 * sides are the BASE / LOCAL / REMOTE text; the `hunks` array lists
 * the unresolved conflict blocks within the MERGED file.
 */
export interface IThreeWayState {
  readonly repositoryID: number
  readonly filePath: string
  readonly baseContent: string
  readonly localContent: string
  readonly remoteContent: string
  readonly mergedContent: string
  readonly hunks: ReadonlyArray<IConflictHunk>
}

/**
 * Extend the existing IMeldSession with a 3-way state slot. When
 * the session is in merge mode, `mode === 'merge'` and `threeWay`
 * is populated.
 */
export interface IMeldSessionMerge {
  readonly id: string
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: 'merge'
  readonly threeWay: IThreeWayState
}