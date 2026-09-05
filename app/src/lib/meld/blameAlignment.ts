import { IBlameHunk } from '../git/blame'

/**
 * Blame information for a single right-side (new file) line in a diff.
 * `null` entries mean the line was removed in the diff (no right-side line
 * to attribute) or no blame info was available.
 */
export type IBlameLine = IBlameHunk

/**
 * Parse a unified diff hunk header (`@@ -a,b +c,d @@ optional section heading`).
 * Returns the 1-based start line of the new (right) side, or null if the
 * header is malformed.
 *
 * The Meld viewer consumes diffs in the form returned by
 * `IDiff` → `text` (raw unified diff text). The header is always the
 * first non-empty line of a hunk block.
 */
export function parseHunkHeader(header: string): {
  readonly oldStart: number
  readonly oldCount: number
  readonly newStart: number
  readonly newCount: number
} | null {
  // Match `@@ -<start>[,<count>] +<start>[,<count>] @@`
  const m = header.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/)
  if (!m) {
    return null
  }
  const oldStart = parseInt(m[1], 10)
  const oldCount = m[2] !== undefined ? parseInt(m[2], 10) : 1
  const newStart = parseInt(m[3], 10)
  const newCount = m[4] !== undefined ? parseInt(m[4], 10) : 1
  return { oldStart, oldCount, newStart, newCount }
}

/**
 * Map blame hunks onto a unified diff.
 *
 * `git blame` reports hunks in terms of the **right-side** (new file) line
 * numbers: `startLine` is 0-based, `lineCount` is the number of consecutive
 * lines attributed to the same commit. This function walks the right side
 * of a unified diff, producing one entry per right-side line in order.
 *
 * Removed lines (`-` prefix) and any line that lacks blame coverage
 * (e.g. untracked, pre-image binary, or a gap between two hunks) yield
 * `null` so the gutter can render a placeholder and keep columns aligned.
 *
 * If `hunks` is empty, every right-side line yields `null` — this is the
 * expected behaviour for an untracked or new file (porcelain blame returns
 * empty in that case).
 */
export function alignBlameToDiff(
  diffText: string,
  hunks: ReadonlyArray<IBlameHunk>
): ReadonlyArray<IBlameLine | null> {
  if (diffText === '') {
    return []
  }

  const lines = diffText.split('\n')
  const result: Array<IBlameLine | null> = []

  // Index blame hunks by startLine for O(1) lookup. Multiple hunks can share
  // a startLine in pathological cases — we keep the first one and let later
  // hunks (if any) re-assign via the linear walk below.
  const hunksByStart = new Map<number, IBlameHunk>()
  for (const h of hunks) {
    if (!hunksByStart.has(h.startLine)) {
      hunksByStart.set(h.startLine, h)
    }
  }

  // Linear walk: maintain a pointer into the blame-hunk array so each
  // right-side line is attributed to the blame hunk whose range covers it.
  let hunkIndex = 0
  // newLineNumber is the 0-based right-side line index. We compare against
  // IBlameHunk.startLine (also 0-based) so they line up directly.
  let newLineNumber = 0
  let currentHunk: IBlameHunk | null = null
  let currentHunkEnd = -1

  for (const raw of lines) {
    if (raw.startsWith('@@')) {
      const header = parseHunkHeader(raw)
      if (header !== null) {
        newLineNumber = header.newStart - 1
        // Reset hunk cursor so a diff hunk restart re-resolves blame.
        hunkIndex = 0
        currentHunk = null
        currentHunkEnd = -1
      }
      continue
    }
    if (raw.startsWith('+')) {
      // Resolve the blame hunk for this 0-based right-side line.
      currentHunk = resolveHunkForLine(
        newLineNumber,
        hunks,
        hunkIndex,
        currentHunk,
        currentHunkEnd
      )
      // Advance hunkIndex if the resolved hunk is past the previous one.
      while (
        hunkIndex < hunks.length - 1 &&
        hunks[hunkIndex + 1].startLine <= newLineNumber
      ) {
        hunkIndex++
      }
      if (currentHunk !== null) {
        currentHunkEnd = currentHunk.startLine + currentHunk.lineCount - 1
      }
      result.push(currentHunk)
      newLineNumber++
    } else if (raw.startsWith('-')) {
      // Removed line: no right-side attribution.
      result.push(null)
    } else if (raw.startsWith(' ') || raw === '') {
      // Context line (or trailing blank). Trailing blank at end-of-file
      // is not a real diff line; only attribute non-blank context lines.
      if (raw === '' && newLineNumber === 0 && lines[lines.length - 1] === '') {
        // ignore trailing empty string from split
        continue
      }
      currentHunk = resolveHunkForLine(
        newLineNumber,
        hunks,
        hunkIndex,
        currentHunk,
        currentHunkEnd
      )
      while (
        hunkIndex < hunks.length - 1 &&
        hunks[hunkIndex + 1].startLine <= newLineNumber
      ) {
        hunkIndex++
      }
      if (currentHunk !== null) {
        currentHunkEnd = currentHunk.startLine + currentHunk.lineCount - 1
      }
      result.push(currentHunk)
      newLineNumber++
    }
    // `\` (no newline at end of file) — skip; not a content line.
  }

  return result
}

function resolveHunkForLine(
  newLineNumber: number,
  hunks: ReadonlyArray<IBlameHunk>,
  hunkIndex: number,
  currentHunk: IBlameHunk | null,
  currentHunkEnd: number
): IBlameHunk | null {
  if (hunks.length === 0) {
    return null
  }
  // Fast path: still inside the previously-resolved hunk's range.
  if (currentHunk !== null && newLineNumber <= currentHunkEnd) {
    return currentHunk
  }
  // Fallback: linear scan from the cursor (usually O(1) amortized).
  for (let i = hunkIndex; i < hunks.length; i++) {
    const h = hunks[i]
    if (
      newLineNumber >= h.startLine &&
      newLineNumber < h.startLine + h.lineCount
    ) {
      return h
    }
    if (h.startLine > newLineNumber) {
      break
    }
  }
  return null
}
