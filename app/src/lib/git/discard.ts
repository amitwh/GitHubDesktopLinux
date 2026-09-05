import { git } from './core'
import { Repository } from '../../models/repository'

/**
 * Discard all changes in the working tree (tracked files) by running
 * `git checkout -- .`.
 *
 * This reverts every tracked file in the working tree to match HEAD.
 * Untracked files are NOT removed — see `clean.ts` for that.
 *
 * @param repository The repository whose working tree should be reset.
 */
export async function discardAllChanges(repository: Repository): Promise<void> {
  await git(['checkout', '--', '.'], repository.path, 'discardAllChanges')
}
