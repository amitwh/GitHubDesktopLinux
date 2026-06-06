import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { Repository } from '../../models/repository'
import { git } from './core'
import { GitError } from 'dugite'

/**
 * Write the given `contents` to `filePath` inside the repository's
 * working directory. Overwrites any existing file at that path.
 * Creates missing parent directories as needed.
 * Does not stage the file — call `stageWorkingDirectoryFile` or
 * `saveMeldEdit` for that.
 */
export async function writeWorkingDirectoryFile(
  repository: Repository,
  filePath: string,
  contents: string
): Promise<void> {
  const fullPath = join(repository.path, filePath)
  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, contents, 'utf8')
}

/**
 * Stage a single working-directory file via `git add <path>`.
 * Exits silently on success; throws a `GitError` on failure.
 */
export async function stageWorkingDirectoryFile(
  repository: Repository,
  filePath: string
): Promise<void> {
  const args = ['add', '--', filePath]
  const result = await git(args, repository.path, 'stageWorkingDirectoryFile', {
    successExitCodes: new Set([0]),
  })
  if (result.gitError !== undefined) {
    throw new GitError(result.gitError, args)
  }
}

/**
 * Convenience: write + stage in one call. This is the path the
 * `MeldWindow` Save button takes when the user is happy with their
 * edit. The two steps are kept separate (`writeWorkingDirectoryFile`
 * and `stageWorkingDirectoryFile`) so the caller can roll back the
 * write if staging fails.
 */
export async function saveMeldEdit(
  repository: Repository,
  filePath: string,
  contents: string
): Promise<void> {
  await writeWorkingDirectoryFile(repository, filePath, contents)
  await stageWorkingDirectoryFile(repository, filePath)
}
