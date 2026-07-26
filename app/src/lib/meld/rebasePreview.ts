/**
 * Phase 3 (Rebase Preview) helpers.
 *
 * This module is split into two concerns:
 *
 *  1. Pure parsers/formatters that operate on the textual output of
 *     `git diff --shortstat <sha>~1..<sha>`. These are dependency-free
 *     and exhaustively unit-tested.
 *
 *  2. A thin wrapper (`runGitShortstat`) that invokes `git` via the
 *     project's existing `git()` helper. The wrapper is intentionally
 *     generic so unit tests can inject a mock `git` via the `deps`
 *     argument; the IPC handler in `meld-ipc.ts` calls this directly.
 *
 * Phase 3 design spec: docs/superpowers/specs/2026-06-05-meld-style-diff-viewer-design.md
 * (see "Phase 3 — Interactive Rebase Preview").
 */

export interface IRebaseCommitStats {
  readonly filesChanged: number
  readonly insertions: number
  readonly deletions: number
}

/** RegExp matching the first line of `git diff --shortstat` output. */
const ShortStatLineRe =
  /\s*(\d+)\s+files? changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/

/**
 * Parse the textual output of `git diff --shortstat <sha>~1..<sha>` into a
 * structured `IRebaseCommitStats` object.
 *
 * Examples of accepted input:
 *   - " 5 files changed, 42 insertions(+), 17 deletions(-)\n"
 *   - " 1 file changed, 7 insertions(+)\n"
 *   - " 1 file changed, 3 deletions(-)\n"
 *   - ""           (initial commit / empty diff)
 *   - "\n"         (whitespace-only)
 *
 * Returns `{ filesChanged: 0, insertions: 0, deletions: 0 }` when:
 *   - the input is empty
 *   - the input has no recognised summary line
 *   - the input has malformed punctuation (e.g. `5 files changed, +12 -4`
 *     without the required parentheses markers — git's real output
 *     always wraps counts in `(+) / (-)`)
 *
 * The first matched line wins; subsequent numstat body lines (binary
 * markers, file content) are ignored because `--shortstat` collapses
 * everything into a single summary line.
 *
 * Real `git diff --shortstat` output always emits at least one of
 * `N insertions(+)` or `N deletions(-)`. We require the same so that
 * caller-side validation can distinguish "empty diff" from "garbage
 * input" without ambiguity.
 */
export function parseShortStat(input: string): IRebaseCommitStats {
  if (typeof input !== 'string') {
    return { filesChanged: 0, insertions: 0, deletions: 0 }
  }
  const lines = input.split(/\r?\n/)
  for (const line of lines) {
    const m = ShortStatLineRe.exec(line)
    if (m !== null) {
      const hasInsertions = m[2] !== undefined
      const hasDeletions = m[3] !== undefined
      // Reject strings like "5 files changed, +12 -4" — git's actual
      // shortstat always wraps counts in `N insertions(+)` or
      // `N deletions(-)`. If neither marker is present we treat the
      // line as malformed and fall through to the zero-stats default.
      if (!hasInsertions && !hasDeletions) {
        return { filesChanged: 0, insertions: 0, deletions: 0 }
      }
      return {
        filesChanged: parseInt(m[1], 10) || 0,
        insertions: hasInsertions ? parseInt(m[2], 10) || 0 : 0,
        deletions: hasDeletions ? parseInt(m[3], 10) || 0 : 0,
      }
    }
  }
  return { filesChanged: 0, insertions: 0, deletions: 0 }
}

/**
 * Format a stats object as a short, human-readable summary suitable for
 * rendering next to a commit row.
 *
 * Format:
 *   - "{N} insertions, {M} deletions" when there are real changes
 *   - "no changes" when filesChanged + insertions + deletions == 0
 */
export function formatStatsSummary(stats: IRebaseCommitStats): string {
  if (
    stats.filesChanged === 0 &&
    stats.insertions === 0 &&
    stats.deletions === 0
  ) {
    return 'no changes'
  }
  return `${stats.insertions} insertions, ${stats.deletions} deletions`
}

// ---------------------------------------------------------------------------
// git wrapper
// ---------------------------------------------------------------------------

/**
 * Generic shape of the `git` helper used by the wrapper. Re-declared
 * here (versus importing the `git` overload from `core.ts`) so this
 * module is importable from the unit tests without pulling in the
 * electron/dugite stack. The IPC handler passes the real `git` from
 * `core.ts`; tests pass a mock.
 */
export interface IGitLike {
  (
    args: ReadonlyArray<string>,
    path: string,
    label: string,
    options?: {
      readonly encoding?: string
      readonly successExitCodes?: ReadonlySet<number>
    }
  ): Promise<{
    readonly stdout: string | Buffer
    readonly exitCode: number
    readonly gitError: unknown
  }>
}

/**
 * Run `git diff --shortstat <sha>^` and return parsed stats. The
 * `<sha>^` (parent) shorthand is git's idiomatic way to express
 * "this commit only"; the diff range resolves to no output for an
 * empty commit and the usual summary line otherwise.
 *
 * `git` is injected so tests can substitute a mock without spawning
 * a real process. The IPC handler in `meld-ipc.ts` passes the
 * upstream `git` from `lib/git/core.ts`.
 *
 * Errors are swallowed and surfaced as zero stats, mirroring the
 * behaviour of the existing `meld:get-blame` handler — the rebase
 * dialog should never block on a single commit's stats.
 */
export async function runGitShortstat(
  repo: { readonly path: string },
  sha: string,
  deps: { readonly git: IGitLike }
): Promise<IRebaseCommitStats> {
  const args: ReadonlyArray<string> = ['diff', '--shortstat', '--no-color', `${sha}^`]
  try {
    const result = await deps.git(
      args as string[],
      repo.path,
      'getRebaseCommitShortstat',
      { encoding: 'buffer', successExitCodes: new Set([0, 128]) }
    )
    let stdout: string
    if (typeof result.stdout === 'string') {
      stdout = result.stdout
    } else if (
      typeof Buffer !== 'undefined' &&
      Buffer.isBuffer(result.stdout)
    ) {
      stdout = (result.stdout as Buffer).toString('utf8')
    } else {
      stdout = ''
    }
    return parseShortStat(stdout)
  } catch {
    return { filesChanged: 0, insertions: 0, deletions: 0 }
  }
}
