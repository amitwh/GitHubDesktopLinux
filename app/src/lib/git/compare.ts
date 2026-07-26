import { git, IGitStringResult } from './core'
import { Repository } from '../../models/repository'
import { GitError as DugiteError } from 'dugite'

/**
 * Resolve the SHA of HEAD~1, the parent of the current commit.
 *
 * Returns `null` when HEAD has no parent (e.g. the initial commit on
 * an unborn / fresh repository, or HEAD is detached at the root commit).
 * Callers should handle `null` by informing the user there is nothing
 * to compare against.
 *
 * @param repository The repository whose previous commit SHA should be resolved.
 */
export async function getPreviousCommitSha(
  repository: Repository
): Promise<string | null> {
  // `git rev-parse --verify HEAD~1` exits with code 128 on an unborn
  // repository ("fatal: ambiguous argument 'HEAD~1'") and code 1
  // when HEAD has no parent ("fatal: ambiguous argument 'HEAD~1'"),
  // depending on git version. Treat both as "no previous commit".
  let result: IGitStringResult | null = null
  try {
    result = await git(
      ['rev-parse', '--verify', '--quiet', 'HEAD~1'],
      repository.path,
      'getPreviousCommitSha',
      {
        successExitCodes: new Set([0, 1, 128]),
      }
    )
  } catch (err) {
    if (err && (err as { result?: { exitCode?: number } }).result) {
      const exit = (err as { result: { exitCode: number } }).result.exitCode
      if (exit === 1 || exit === 128) {
        return null
      }
    }
    throw err
  }

  if (result === null || result.exitCode !== 0) {
    return null
  }

  const sha = (result.stdout ?? '').toString().trim()
  return sha.length > 0 ? sha : null
}

/**
 * Convenience helper: returns true when `getPreviousCommitSha` would
 * find a parent. Avoids the need for callers to import `DugiteError`.
 */
export async function hasPreviousCommit(
  repository: Repository
): Promise<boolean> {
  const sha = await getPreviousCommitSha(repository)
  return sha !== null
}

// Re-export for callers that want to filter Dugite errors without
// importing from 'dugite' directly.
export { DugiteError }