import { writeFile, mkdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { Repository } from '../../models/repository'
import { git } from './core'

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
  if (result.gitError) {
    throw new Error(`Failed to stage ${filePath}: ${String(result.gitError)}`)
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

/**
 * Read the current contents of a file in the working directory.
 * Returns `undefined` if the file doesn't exist (e.g. it was deleted
 * by an external process). Throws on any other I/O error.
 */
export async function readWorkingDirectoryFile(
  repository: Repository,
  filePath: string
): Promise<string | undefined> {
  const fullPath = join(repository.path, filePath)
  try {
    return await readFile(fullPath, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw e
  }
}
