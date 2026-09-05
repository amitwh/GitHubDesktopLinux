import { Repository } from '../../models/repository'
import { getBlobContents } from './show'
import { coerceToString } from './coerce-to-string'
import { readWorkingDirectoryFile } from './working-directory'

/**
 * The three sides of a three-way merge conflict.
 *
 * - `baseContent` is the common-ancestor text (empty string when the file
 *   was created independently on both branches and has no common ancestor).
 * - `localContent` is the version on the current branch (read from the
 *   working tree so it reflects any uncommitted changes).
 * - `remoteContent` is the version from the incoming branch tip, read
 *   via `git show <theirs>:<path>`.
 */
export interface IThreeWayContents {
  /** Common-ancestor content (empty string if the file was added in both branches). */
  readonly baseContent: string
  /** The current branch's version (read from the working tree). */
  readonly localContent: string
  /** The incoming branch's version (read via `git show <theirs>:<path>`). */
  readonly remoteContent: string
}

/**
 * Read the three sides of a merge conflict for `filePath`. The caller
 * supplies the SHA of the common ancestor (merge-base) and the SHA of the
 * incoming branch tip.
 *
 * - BASE is retrieved via `git show <mergeBaseSha>:<filePath>`. If the
 *   path does not exist at that revision (e.g. the file was added on only
 *   one branch) the blob lookup fails — `baseContent` will be `''`.
 * - LOCAL is read directly from the working tree via `readWorkingDirectoryFile`
 *   so it includes any uncommitted edits.
 * - REMOTE is retrieved via `git show <theirsSha>:<filePath>`. Same
 *   empty-string fallback applies when the path was added on the base
 *   branch only.
 */
export async function readThreeWayContents(
  repository: Repository,
  filePath: string,
  mergeBaseSha: string,
  theirsSha: string
): Promise<IThreeWayContents> {
  const [baseBlob, localContent, remoteBlob] = await Promise.all([
    getBlobContentsSafe(repository, mergeBaseSha, filePath),
    readWorkingDirectoryFile(repository, filePath),
    getBlobContentsSafe(repository, theirsSha, filePath),
  ])

  return {
    baseContent: baseBlob,
    localContent: localContent ?? '',
    remoteContent: remoteBlob,
  }
}

/**
 * Call `getBlobContents` and return `''` on any error (e.g. the path does
 * not exist at the given revision). This matches the git semantics for a
 * file that was independently added on two branches.
 */
async function getBlobContentsSafe(
  repository: Repository,
  commitish: string,
  path: string
): Promise<string> {
  try {
    const buffer = await getBlobContents(repository, commitish, path)
    return coerceToString(buffer)
  } catch {
    return ''
  }
}
