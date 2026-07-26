import * as ipcMain from '../ipc-main'
import { spawn } from 'child_process'
import { writeFile, mkdtemp, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { getDefaultExternalTools } from '../../lib/meld/default-tools'
import { substituteArgs } from '../../lib/meld/external-tool-args'
import { IExternalTool } from '../../models/external-tool'
import { gitMergeFile } from '../../lib/git/merge-file'
import { getBlame, IBlameHunk } from '../../lib/git/blame'
import {
  getStashList,
  getStashFiles,
  IAllStashEntry,
} from '../../lib/git/stash'
import { CommittedFileChange } from '../../models/status'
import { getSubmoduleStatus, getSubmoduleDiff } from '../../lib/git/submodule'
import { Repository } from '../../models/repository'
import { openMeldWindow, IOpenMeldWindowArgs } from './meld-window'
import {
  IRebaseCommitStats,
  parseShortStat,
} from '../../lib/meld/rebasePreview'
import { git } from '../../lib/git/core'

interface ILaunchToolRequest {
  readonly tool: IExternalTool
  readonly leftPath: string
  readonly rightPath: string
  readonly basePath?: string
}

interface IAutoMergeRequest {
  readonly repositoryPath: string
  readonly baseContent: string
  readonly localContent: string
  readonly remoteContent: string
}

interface IGetBlameRequest {
  readonly repositoryPath: string
  readonly filePath: string
}

interface IGetRebaseCommitStatsRequest {
  readonly repositoryPath: string
  readonly sha: string
}

interface IGetRebaseCommitDiffRequest {
  readonly repositoryPath: string
  readonly sha: string
}

interface IRepositoryPathRequest {
  readonly repositoryPath: string
}

interface IGetStashFilesRequest {
  readonly repositoryPath: string
  readonly stashSha: string
}

interface IGetSubmoduleDiffRequest {
  readonly repositoryPath: string
  readonly submodulePath: string
}

export function registerMeldIpcHandlers() {
  ipcMain.handle('meld:list-tools', async () => {
    return getDefaultExternalTools()
  })

  ipcMain.handle('meld:open-window', async (_event, args: unknown) => {
    const sessionID = openMeldWindow(args as IOpenMeldWindowArgs)
    return { sessionID }
  })

  ipcMain.handle('meld:launch-external-tool', async (_event, req: unknown) => {
    const r = req as ILaunchToolRequest
    const args = substituteArgs(r.tool, {
      leftPath: r.leftPath,
      rightPath: r.rightPath,
      basePath: r.basePath,
    })
    return new Promise<{ success: boolean; error?: string }>(resolve => {
      const [cmd, ...cmdArgs] = args
      const child = spawn(cmd!, cmdArgs, { detached: true, stdio: 'ignore' })
      child.on('error', err => {
        resolve({ success: false, error: `Failed to launch tool: ${err.message}` })
      })
      child.on('spawn', () => {
        child.unref()
        resolve({ success: true })
      })
    })
  })

  /**
   * Phase 1b: thin forwarder for save-edits. The actual write + stage
   * is performed in the renderer via the dispatcher, which has access
   * to the AppStore and git helpers. This handler exists so the
   * channel is registered and tests can spy on it; future phases
   * (3-way merge) will move the write logic into the main process
   * where it can hold the index lock across multiple file writes.
   */
  ipcMain.handle('meld:save-edits', async () => {
    return { success: true }
  })

  /**
   * Phase 1c: run `git merge-file` in the main process. The renderer
   * sends the three sides of a 3-way merge and gets back the merged
   * content. We write the three inputs to a temp dir, invoke the
   * existing `gitMergeFile` helper, and clean up.
   *
   * Keeping the git call in the main process means the renderer never
   * has to spawn `git` directly, and tests can mock the IPC channel.
   */
  ipcMain.handle('meld:auto-merge', async (_event, req: unknown) => {
    const r = req as IAutoMergeRequest
    const repository: Repository = {
      id: -1,
      name: '',
      path: r.repositoryPath,
      hash: '',
      lastFetched: null,
    } as unknown as Repository

    const tmpDir = await mkdtemp(join(tmpdir(), 'ghd-meld-merge-'))
    const basePath = join(tmpDir, 'BASE')
    const oursPath = join(tmpDir, 'OURS')
    const theirsPath = join(tmpDir, 'THEIRS')

    try {
      await Promise.all([
        writeFile(basePath, r.baseContent, 'utf8'),
        writeFile(oursPath, r.localContent, 'utf8'),
        writeFile(theirsPath, r.remoteContent, 'utf8'),
      ])

      const result = await gitMergeFile(repository, basePath, oursPath, theirsPath)

      // git merge-file writes the merged result to basePath in place.
      const mergedContent = await readFile(basePath, 'utf8')

      return {
        mergedContent,
        clean: result.clean,
        conflictCount: result.conflictCount,
      }
    } finally {
      void rm(tmpDir, { recursive: true, force: true })
    }
  })

  /**
   * Phase 2 (T1, BlameGutter): fetch blame information for a file
   * using the existing `git blame` wrapper. The renderer passes the
   * working-directory-relative file path; the main process turns the
   * absolute repository path + relative path into a Repository stub
   * (mirroring the pattern used by `meld:auto-merge` above) and calls
   * the same `getBlame` function the main app uses.
   *
   * Returns the array of `IBlameHunk` (which is JSON-serialisable).
   * On failure (e.g. binary file, file not tracked, exit code 128) the
   * handler returns an empty array — the renderer treats empty as
   * "no blame data available" and renders placeholder cells in the
   * gutter.
   */
  ipcMain.handle('meld:get-blame', async (_event, req: unknown) => {
    const r = req as IGetBlameRequest
    if (typeof r.repositoryPath !== 'string' || typeof r.filePath !== 'string') {
      return [] as ReadonlyArray<IBlameHunk>
    }
    const repository: Repository = {
      id: -1,
      name: '',
      path: r.repositoryPath,
      hash: '',
      lastFetched: null,
    } as unknown as Repository

    try {
      return await getBlame(repository, r.filePath)
    } catch (err) {
      // Binary files, untracked files, or git errors — return an empty
      // list and let the renderer render a placeholder column.
      console.warn(
        `[meld:get-blame] blame failed for ${r.filePath}:`,
        err instanceof Error ? err.message : String(err)
      )
      return [] as ReadonlyArray<IBlameHunk>
    }
  })

  /**
   * Phase 3 (Rebase Preview): run `git diff --shortstat <sha>^` to
   * get aggregate stats (files/insertions/deletions) for a single
   * commit in the interactive-rebase planner. The renderer calls this
   * once per row (debounced) so stats update live as the user reorders
   * / squashes / fixups / drops commits.
   *
   * On any error (invalid SHA, root commit with no parent, git
   * failure) we return zero stats so the row falls through to the
   * "no changes" branch rather than blocking the dialog.
   */
  ipcMain.handle(
    'meld:get-rebase-commit-stats',
    async (_event, req: unknown) => {
      const r = req as IGetRebaseCommitStatsRequest
      const empty: IRebaseCommitStats = {
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
      }
      if (typeof r.repositoryPath !== 'string' || typeof r.sha !== 'string') {
        return empty
      }
      try {
        const result = await git(
          ['diff', '--shortstat', '--no-color', `${r.sha}^`],
          r.repositoryPath,
          'getRebaseCommitShortstat',
          { encoding: 'buffer', successExitCodes: new Set([0, 128]) }
        )
        const stdout = Buffer.isBuffer(result.stdout)
          ? result.stdout.toString('utf8')
          : typeof result.stdout === 'string'
            ? result.stdout
            : ''
        return parseShortStat(stdout)
      } catch (err) {
        console.warn(
          `[meld:get-rebase-commit-stats] failed for ${r.sha}:`,
          err instanceof Error ? err.message : String(err)
        )
        return empty
      }
    }
  )

  /**
   * Phase 3 (Rebase Preview): get the full unified diff for a single
   * commit in the interactive-rebase planner. Returns the raw
   * `git show <sha>` output (with no per-file metadata) so the
   * renderer can feed it into `MeldDiffPane`. On error returns an
   * empty string.
   */
  ipcMain.handle(
    'meld:get-rebase-commit-diff',
    async (_event, req: unknown) => {
      const r = req as IGetRebaseCommitDiffRequest
      if (typeof r.repositoryPath !== 'string' || typeof r.sha !== 'string') {
        return ''
      }
      try {
        const result = await git(
          ['show', '--no-color', '--format=', '--patch', r.sha],
          r.repositoryPath,
          'getRebaseCommitDiff',
          { encoding: 'buffer', successExitCodes: new Set([0, 128]) }
        )
        const stdout = Buffer.isBuffer(result.stdout)
          ? result.stdout.toString('utf8')
          : typeof result.stdout === 'string'
            ? result.stdout
            : ''
        return stdout
      } catch (err) {
        // Defensive: never throw to the renderer; instead log and
        // surface an empty diff so the Meld window can render a "no
        // changes available" message of its own.
        console.warn(
          `[meld:get-rebase-commit-diff] failed for ${r.sha}:`,
          err instanceof Error ? err.message : String(err)
        )
        return ''
      }
    }
  )

  /**
   * Phase 2 (T2, MeldStashView): list all stash entries in the
   * repository so the Meld file tree can show them as expandable
   * nodes. Uses the same `getStashList` helper as the renderer-side
   * stash-manager dialog.
   *
   * On failure (e.g. no stashes, not a repo) returns an empty list
   * so the renderer can render an empty tree gracefully.
   */
  ipcMain.handle('meld:list-stashes', async (_event, req: unknown) => {
    const r = req as IRepositoryPathRequest
    if (typeof r.repositoryPath !== 'string') {
      return [] as ReadonlyArray<IAllStashEntry>
    }
    const repository: Repository = {
      id: -1,
      name: '',
      path: r.repositoryPath,
      hash: '',
      lastFetched: null,
    } as unknown as Repository

    try {
      return await getStashList(repository)
    } catch (err) {
      console.warn(
        `[meld:list-stashes] failed for ${r.repositoryPath}:`,
        err instanceof Error ? err.message : String(err)
      )
      return [] as ReadonlyArray<IAllStashEntry>
    }
  })

  /**
   * Phase 2 (T2, MeldStashView): get the list of files changed in a
   * specific stash entry. Returns `CommittedFileChange[]` which is
   * JSON-serialisable and contains everything the diff pane needs
   * to render the file (path, status, commitish, parentCommitish).
   */
  ipcMain.handle('meld:get-stash-files', async (_event, req: unknown) => {
    const r = req as IGetStashFilesRequest
    if (typeof r.repositoryPath !== 'string' || typeof r.stashSha !== 'string') {
      return [] as ReadonlyArray<CommittedFileChange>
    }
    const repository: Repository = {
      id: -1,
      name: '',
      path: r.repositoryPath,
      hash: '',
      lastFetched: null,
    } as unknown as Repository

    try {
      return await getStashFiles(repository, r.stashSha)
    } catch (err) {
      console.warn(
        `[meld:get-stash-files] failed for ${r.stashSha}:`,
        err instanceof Error ? err.message : String(err)
      )
      return [] as ReadonlyArray<CommittedFileChange>
    }
  })

  /**
   * Phase 2 (T3, MeldSubmoduleView): list submodules with a coarse
   * clean/modified/uninitialized status indicator for the Meld file
   * tree. Mirrors the dispatcher's `listSubmodules` shape but with
   * a simpler status enum.
   */
  ipcMain.handle('meld:list-submodules', async (_event, req: unknown) => {
    const r = req as IRepositoryPathRequest
    if (typeof r.repositoryPath !== 'string') {
      return []
    }
    const repository: Repository = {
      id: -1,
      name: '',
      path: r.repositoryPath,
      hash: '',
      lastFetched: null,
    } as unknown as Repository

    try {
      return await getSubmoduleStatus(repository)
    } catch (err) {
      console.warn(
        `[meld:list-submodules] failed for ${r.repositoryPath}:`,
        err instanceof Error ? err.message : String(err)
      )
      return []
    }
  })

  /**
   * Phase 2 (T3, MeldSubmoduleView): get the unified diff for a
   * single submodule against the parent's recorded SHA. Returns an
   * empty string when the submodule has no diff or git could not
   * produce one (e.g. uninitialized submodule).
   */
  ipcMain.handle(
    'meld:get-submodule-diff',
    async (_event, req: unknown) => {
      const r = req as IGetSubmoduleDiffRequest
      if (
        typeof r.repositoryPath !== 'string' ||
        typeof r.submodulePath !== 'string'
      ) {
        return ''
      }
      const repository: Repository = {
        id: -1,
        name: '',
        path: r.repositoryPath,
        hash: '',
        lastFetched: null,
      } as unknown as Repository

      try {
        return await getSubmoduleDiff(repository, r.submodulePath)
      } catch (err) {
        console.warn(
          `[meld:get-submodule-diff] failed for ${r.submodulePath}:`,
          err instanceof Error ? err.message : String(err)
        )
        return ''
      }
    }
  )
}
