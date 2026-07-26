import { git } from './core'
import { Repository } from '../../models/repository'

/**
 * Remove all untracked files and directories from the working tree by
 * running `git clean -fd`.
 *
 * This is destructive: any untracked file or directory that is not
 * ignored is removed permanently. Tracked files are not touched.
 *
 * @param repository The repository whose working tree should be cleaned.
 */
export async function cleanUntrackedFiles(
  repository: Repository
): Promise<void> {
  await git(['clean', '-fd'], repository.path, 'cleanUntrackedFiles')
}