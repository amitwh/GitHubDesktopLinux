import { diffChars, IChange } from 'diff'
import { IMeldEditState } from '../../models/meld-edit'

/**
 * A single span of the char-level diff between two strings. `value` is
 * always present. At most one of `added` / `removed` is set; neither
 * means the part is unchanged on both sides.
 *
 * Mirrors the shape returned by the `diff` package's `diffChars` so
 * the UI can render it directly, but with the optional flags narrowed
 * to the boolean type that React renders as data attributes.
 */
export interface ICharDiffPart {
  readonly value: string
  readonly added?: boolean
  readonly removed?: boolean
}

/**
 * A half-open-then-closed inclusive line range. Used by `copyHunk`
 * to describe which lines in the target should be replaced.
 */
export interface IHunkRange {
  readonly start: number
  readonly end: number
}

/**
 * Compute a char-level diff between `left` and `right`. Returned parts
 * concatenate to a string that is *not* the same as either input —
 * it interleaves insertions and deletions. To reconstruct one side
 * from the parts, drop the opposite flag:
 *   - `left`  = parts where !added, joined
 *   - `right` = parts where !removed, joined
 */
export function computeCharDiff(
  left: string,
  right: string
): ReadonlyArray<ICharDiffPart> {
  const changes: ReadonlyArray<IChange> = diffChars(left, right)
  return changes.map<ICharDiffPart>(c => {
    if (c.added) {
      return { value: c.value, added: true }
    }
    if (c.removed) {
      return { value: c.value, removed: true }
    }
    return { value: c.value }
  })
}

/**
 * Replace (or insert) a hunk of `source` into `target` at the given
 * line range. The semantics are:
 *   - The hunk's "size" is `hunk.end - hunk.start + 1` lines.
 *   - Source lines are taken starting at index `hunk.start`, clamped
 *     to the actual source length.
 *   - If the source slice is empty (e.g. `hunk.start` is past the
 *     source end), the first line of the source is used as a single
 *     fallback line — this matches what most diff-copy UIs do: give
 *     the user *something* to insert even if the range is degenerate.
 *   - The target range `[hunk.start .. hunk.end]` is clamped; if it
 *     falls past the target's end, the source slice is appended.
 */
export function copyHunk(
  source: string,
  target: string,
  hunk: IHunkRange
): string {
  const sourceLines = source.split('\n')
  const targetLines = target.split('\n')

  const sourceStart = Math.min(hunk.start, sourceLines.length)
  const sourceEnd = Math.min(hunk.end + 1, sourceLines.length)
  const sourceSlice: ReadonlyArray<string> =
    sourceStart < sourceEnd
      ? sourceLines.slice(sourceStart, sourceEnd)
      : hunk.start >= sourceLines.length
      ? [sourceLines[0]]
      : []

  const targetStart = Math.min(hunk.start, targetLines.length)
  const targetEnd = Math.min(hunk.end + 1, targetLines.length)

  const before = targetLines.slice(0, targetStart)
  const after = targetLines.slice(targetEnd)
  return [...before, ...sourceSlice, ...after].join('\n')
}

/**
 * Revert both panes to their original (load-time) content and clear
 * `hasChanges`. The `*Original` fields are preserved so the user can
 * re-edit and re-revert.
 */
export function revertEdits(state: IMeldEditState): IMeldEditState {
  return {
    leftContent: state.leftOriginal,
    rightContent: state.rightOriginal,
    leftOriginal: state.leftOriginal,
    rightOriginal: state.rightOriginal,
    hasChanges: false,
  }
}

/**
 * Apply an edit to one side of the pane and recompute `hasChanges`
 * by comparing each side to its original. The `*Original` fields
 * are never modified by edits — only the user's save/discard flow
 * updates them.
 */
export function applyEdit(
  state: IMeldEditState,
  side: 'left' | 'right',
  newContent: string
): IMeldEditState {
  const nextLeft = side === 'left' ? newContent : state.leftContent
  const nextRight = side === 'right' ? newContent : state.rightContent
  const hasChanges = nextLeft !== state.leftOriginal || nextRight !== state.rightOriginal
  return {
    leftContent: nextLeft,
    rightContent: nextRight,
    leftOriginal: state.leftOriginal,
    rightOriginal: state.rightOriginal,
    hasChanges,
  }
}
