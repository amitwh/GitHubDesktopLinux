import { opendir, stat } from 'fs/promises'
import { join } from 'path'

import * as ipcMain from '../ipc-main'

interface IComputeSizesRequest {
  readonly paths: ReadonlyArray<string>
}

interface IComputeSizesResponse {
  readonly sizes: ReadonlyArray<{ path: string; size: number } | null>
}

/**
 * Walk a directory tree and sum file sizes. Best-effort: files that
 * disappear, are unreadable, or are otherwise not stat-able are silently
 * skipped so the overall computation still completes. Symlinks are not
 * followed (we use `lstat`-equivalent `stat` without dereferencing).
 *
 * Uses manual iteration via `read()`/`readSync` to avoid the
 * `for await (const entry of dir)` auto-close behavior introduced in
 * Node 20+ — that pattern would close the handle mid-loop and any
 * subsequent `dir.close()` call would throw `ERR_DIR_CLOSED`.
 */
async function computeDirectorySize(path: string): Promise<number> {
  let size = 0
  let directory
  try {
    directory = await opendir(path)
  } catch {
    // Directory missing or unreadable — caller treats the whole entry as null.
    throw new Error(`cannot open directory: ${path}`)
  }
  try {
    for (;;) {
      let entry: import('fs').Dirent | null
      try {
        entry = await directory.read()
      } catch {
        // read error — bail out of this branch.
        break
      }
      if (entry === null) {
        break
      }
      const entryPath = join(path, entry.name)
      if (entry.isDirectory()) {
        try {
          size += await computeDirectorySize(entryPath)
        } catch {
          // Sub-directory went away mid-walk — skip.
        }
      } else if (entry.isFile()) {
        try {
          size += (await stat(entryPath)).size
        } catch {
          // File disappeared or cannot be read — skip.
        }
      }
    }
  } finally {
    try {
      await directory.close()
    } catch {
      // already closed — ignore.
    }
  }
  return size
}

export function registerWorktreeIpcHandlers() {
  /**
   * Compute disk usage for a batch of worktree paths. Returns one entry
   * per input path; `null` for paths that don't exist or aren't a
   * directory, so the renderer can render "—" without crashing.
   *
   * The walk runs in the main process so the renderer's thread is never
   * blocked by large file trees. The renderer can request a refresh at
   * any time and display the result asynchronously.
   */
  ipcMain.handle(
    'worktree:compute-sizes',
    async (
      _event,
      req: IComputeSizesRequest
    ): Promise<IComputeSizesResponse> => {
      const sizes: Array<{ path: string; size: number } | null> = []
      for (const path of req.paths) {
        if (typeof path !== 'string') {
          sizes.push(null)
          continue
        }
        try {
          const rootStat = await stat(path)
          if (!rootStat.isDirectory()) {
            sizes.push(null)
            continue
          }
          const size = await computeDirectorySize(path)
          sizes.push({ path, size })
        } catch {
          sizes.push(null)
        }
      }
      return { sizes }
    }
  )
}
