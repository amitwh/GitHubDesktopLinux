import { Repository } from '../../models/repository'
import { git } from './core'

/**
 * The result of running `git merge-file`. `clean` is true when
 * `conflictCount` is zero — i.e. no `<<<<<<<` markers remain in
 * the merged output.
 */
export interface IGitMergeFileResult {
  /** The merged content (with conflict markers if any conflicts). */
  readonly mergedContent: string
  /** True when no conflict markers remain in the merged output. */
  readonly clean: boolean
  /** Conflict count, 0 when clean. */
  readonly conflictCount: number
}

/**
 * Parse the result of `git merge-file` and produce a structured result.
 *
 * `git merge-file` exit codes:
 *0 — clean merge, no conflicts
 *   1 — conflicts present, output contains conflict markers
 *  -1 — error (file not found, unreadable, etc.)
 *
 * Conflict count is derived by counting `<<<<<<<` markers in the output.
 * We trust the exit code over the marker count for the `clean` field:
 * exit 0 means git reported success regardless of any residual markers.
 *
 * @param mergedContent The stdout from `git merge-file`.
 * @param exitCode      The process exit code from `git merge-file`.
 */
export function parseMergeFileResult(
  mergedContent: string,
  exitCode: number
): IGitMergeFileResult {
  const conflictCount =
    exitCode === 0 ? 0 : mergedContent.match(/<<<<<<</g)?.length ?? 0

  return {
    mergedContent,
    clean: conflictCount === 0,
    conflictCount,
  }
}

/**
 * Run `git merge-file` to perform a three-way merge of a single file.
 *
 * The caller is responsible for writing the three input files to disk
 * before calling this function. All three paths are relative to the
 * repository root and are passed directly to `git merge-file`.
 *
 * `git merge-file` semantics:
 *   - Reads the common ancestor at `currentPath` (BASE)
 *   - Reads the local/ours version at `oursPath`
 *   - Reads the remote/theirs version at `theirsPath`
 *   - Writes the merged result to `currentPath` in place
 *   - Exit 0 = clean merge, exit 1 = conflicts written in place
 *
 * @param repository  The repository in which to run the merge.
 * @param currentPath Relative path to the BASE/common-ancestor file.
 * @param oursPath    Relative path to the LOCAL (ours) version.
 * @param theirsPath  Relative path to the REMOTE (theirs) version.
 */
export async function gitMergeFile(
  repository: Repository,
  currentPath: string,
  oursPath: string,
  theirsPath: string
): Promise<IGitMergeFileResult> {
  const args = ['merge-file', '--ours', currentPath, oursPath, theirsPath]

  // git merge-file writes the merged result to currentPath in place
  // and emits the merged content to stdout.
  // Exit codes: 0 = clean, 1 = conflicts, -1 = error
  const result = await git(args, repository.path, 'gitMergeFile', {
    // git merge-file can exit 1 when there are conflicts — still parse output
    successExitCodes: new Set([0, 1]),
  })

  return parseMergeFileResult(result.stdout, result.exitCode)
}
