/**
 * Parse, synthesize, and resolve git conflict markers in a MERGED file.
 *
 * Git conflict markers follow two variants:
 * - **4-marker** (default): `<<<<<<< HEAD`, `||||||| <label>`, `<base>`,
 *   `=======`, `>>>>>>> branch` — the line after `||||||| <label>`
 *   is the base content.
 * - **3-marker** (no base): `<<<<<<< HEAD`, `=======`, `>>>>>>> branch`
 *   → `baseContent === ''`
 *
 * See `docs/superpowers/specs/2026-06-05-meld-style-diff-viewer-design.md`
 * (Phase 1c section) for the spec these types implement.
 */

import { IConflictHunk } from '../../models/meld-merge'

/**
 * A region parsed from a MERGED file.
 *
 * Context regions are the non-conflicting parts between and around
 * conflict blocks. Conflict regions wrap a single `IConflictHunk`.
 */
export type IConflictRegion =
  | {
      readonly kind: 'context'
      readonly content: string
      readonly startLine: number
      readonly endLine: number
    }
  | { readonly kind: 'conflict'; readonly hunk: IConflictHunk }

/** Marker strings that delimit a conflict block. */
const MARKER_START = '<<<<<<< '
const MARKER_BASE = '|||||||'
const MARKER_SEP = '======='
const MARKER_END = '>>>>>>> '

/**
 * Parse a MERGED file into alternating "context" and "conflict" regions.
 *
 * Returns regions in source order. A file with no conflicts yields
 * exactly one `kind: 'context'` region covering the whole file.
 * A file with N conflict blocks yields 2N+1 regions (alternating
 * context / conflict / context / … / conflict / context).
 *
 * Line numbers are 0-indexed. `endLine` is inclusive.
 */
export function parseConflictMarkers(
  merged: string,
): ReadonlyArray<IConflictRegion> {
  const lines = merged.split('\n')
  const regions: IConflictRegion[] = []

  let pos = 0 // 0-indexed line cursor

  while (pos < lines.length) {
    if (lines[pos].startsWith(MARKER_START)) {
      const hunk = parseConflictBlock(lines, pos)
      regions.push({ kind: 'conflict', hunk })
      pos = hunk.endLine + 1
    } else {
      // Collect a run of non-conflict lines as one context region
      const startLine = pos
      let endLine = pos
      while (
        endLine < lines.length &&
        !lines[endLine].startsWith(MARKER_START)
      ) {
        endLine++
      }
      // endLine is one past the last non-conflict line (or lines.length)
      const content = lines.slice(startLine, endLine).join('\n')
      regions.push({ kind: 'context', content, startLine, endLine: endLine - 1 })
      pos = endLine
    }
  }

  return regions
}

/**
 * Internal: parse a single conflict block starting at `startLineIdx`
 * (the line that bears `<<<<<<<`). Returns an `IConflictHunk` with
 * correct line indices. Does NOT consume the line after `>>>>>>>` —
 * the caller advances the cursor past it.
 *
 * **4-marker** (`||||||| <label>` on its own line, base on next line):
 *   `baseLabelBlank` is false. The base content follows on the line
 *   immediately after the `||||||| <label>` line.
 *
 * **3-marker** (no `|||||||` at all): `baseContent === ''`.
 *
 * When a `|||||||` line is bare (no trailing text), `baseLabelBlank`
 * is true and the base content follows on the next line.
 * When it has trailing text (e.g. `||||||| base`), `baseLabelBlank`
 * is false/undefined and the base still follows on the next line.
 */
function parseConflictBlock(
  lines: string[],
  startLineIdx: number,
): IConflictHunk {
  let localContent = ''
  let baseContent = ''
  let baseLabel: string | undefined
  let remoteContent = ''

  let phase: 'local' | 'base' | 'remote' = 'local'
  let lineIdx = startLineIdx + 1

  while (lineIdx < lines.length) {
    const line = lines[lineIdx]

    if (line.startsWith(MARKER_BASE)) {
      // `|||||||` — switch to base section.
      // If the line has trailing text after `||||||| ` (e.g. `||||||| base`),
      // that text is the base label. The actual base content follows on the
      // NEXT line and is accumulated in the base phase.
      // If the line is bare `|||||||`, baseLabel stays undefined and the
      // base content (if any) is accumulated from the next line.
      const afterMarker = line.slice(MARKER_BASE.length + 1)
      if (afterMarker.length > 0) {
        baseLabel = afterMarker
      }
      phase = 'base'
      lineIdx++
      continue
    }

    if (line.startsWith(MARKER_SEP)) {
      // `=======` — separator, switch to remote
      phase = 'remote'
      lineIdx++
      continue
    }

    if (line.startsWith(MARKER_END)) {
      // `>>>>>>> ...` — end of conflict block.
      // Extract the end label (everything after `>>>>>>> `).
      const endLabel = line.slice(MARKER_END.length)
      return {
        baseContent,
        localContent,
        remoteContent,
        startLine: startLineIdx,
        endLine: lineIdx,
        baseLabel,
        endLabel: endLabel.length > 0 ? endLabel : undefined,
      }
    }

    // Accumulate content into the current phase
    if (phase === 'local') {
      localContent += (localContent.length > 0 ? '\n' : '') + line
    } else if (phase === 'base') {
      baseContent += (baseContent.length > 0 ? '\n' : '') + line
    } else {
      remoteContent += (remoteContent.length > 0 ? '\n' : '') + line
    }

    lineIdx++
  }

  // Unreachable — `>>>>>>>` always terminates the block
  return {
    baseContent,
    localContent,
    remoteContent,
    startLine: startLineIdx,
    endLine: lineIdx,
    baseLabel,
  }
}

/**
 * Build a MERGED file from a list of regions. This is the inverse of
 * `parseConflictMarkers`: re-serialising a parsed region list produces
 * the original file byte-for-byte (modulo whitespace).
 *
 * Context regions are emitted verbatim. Conflict regions are serialised as:
 *   <<<<<<< HEAD
 *   <localContent>
 *   |||||||            ← bare marker when baseLabelBlank is true
 *   ||||||| <label>    ← labelled marker when baseLabelBlank is false/absent
 *   <baseContent>
 *   =======
 *   <remoteContent>
 *   >>>>>>> branch
 */
export function synthesizeMerge(
  regions: ReadonlyArray<
    | { readonly kind: 'context'; readonly content: string }
    | { readonly kind: 'conflict'; readonly hunk: IConflictHunk }
  >,
): string {
  const parts: string[] = []

  for (const region of regions) {
    if (region.kind === 'context') {
      parts.push(region.content)
    } else {
      const { baseContent, localContent, remoteContent, baseLabel, endLabel } =
        region.hunk
      parts.push('<<<<<<< HEAD')
      parts.push(localContent)

      if (baseContent.length > 0 || baseLabel !== undefined) {
        // 4-marker variant: output the base label line then the base content
        if (baseLabel !== undefined) {
          // Labelled base: `||||||| <baseLabel>\n<baseContent>\n`
          parts.push('||||||| ' + baseLabel)
          parts.push(baseContent)
        } else {
          // Bare base marker: `|||||||\n<baseContent>\n`
          parts.push('|||||||')
          parts.push(baseContent)
        }
      }

      parts.push('=======')
      parts.push(remoteContent)
      parts.push('>>>>>>> ' + (endLabel ?? 'HEAD'))
    }
  }

  return parts.join('\n')
}

/**
 * Re-render a single conflict hunk inside a MERGED file, replacing the
 * entire `<<<<<<< … >>>>>>>` block with the content of the chosen side:
 * - `side: 'local'`  → `localContent`
 * - `side: 'remote'` → `remoteContent`
 * - `side: 'base'`   → `baseContent` if non-empty, otherwise empty string
 *
 * `hunkIndex` is the 0-based index of the conflict block in the order
 * produced by `buildConflictHunks` (i.e. by scan order of `<<<<<<<`).
 *
 * Returns the full MERGED text with that hunk resolved. All other
 * conflict markers are left untouched.
 */
export function applyHunkResolution(
  merged: string,
  hunkIndex: number,
  side: 'base' | 'local' | 'remote',
): string {
  const hunks = buildConflictHunks(merged)

  if (hunkIndex < 0 || hunkIndex >= hunks.length) {
    throw new Error(
      `applyHunkResolution: hunkIndex ${hunkIndex} out of range (${hunks.length} hunks)`,
    )
  }

  const target = hunks[hunkIndex]

  const allLines = merged.split('\n')
  const preLines = allLines.slice(0, target.startLine)
  const postLines = allLines.slice(target.endLine + 1)

  const replacement =
    side === 'local'
      ? target.localContent
      : side === 'remote'
        ? target.remoteContent
        : target.baseContent

  return [...preLines, replacement, ...postLines].join('\n')
}

/**
 * Locate all conflict regions in `merged` and return them in source
 * order. Used by `MeldMergedPane` to render per-hunk action bars and
 * by `applyHunkResolution` to locate the target block.
 *
 * A 4-marker block and a 3-marker block are both parsed; the absence
 * of `|||||||` causes `baseContent` to be empty and `baseLabelBlank`
 * to be undefined.
 *
 * Returns an empty array when `merged` contains no conflict markers.
 */
export function buildConflictHunks(merged: string): ReadonlyArray<IConflictHunk> {
  const lines = merged.split('\n')
  const hunks: IConflictHunk[] = []

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(MARKER_START)) {
      hunks.push(parseConflictBlock(lines, i))
    }
  }

  return hunks
}