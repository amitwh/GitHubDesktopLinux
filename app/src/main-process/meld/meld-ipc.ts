import * as ipcMain from '../ipc-main'
import { spawn } from 'child_process'
import { writeFile, mkdtemp, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { getDefaultExternalTools } from '../../lib/meld/default-tools'
import { substituteArgs } from '../../lib/meld/external-tool-args'
import { IExternalTool } from '../../models/external-tool'
import { gitMergeFile } from '../../lib/git/merge-file'
import { Repository } from '../../models/repository'
import { openMeldWindow, IOpenMeldWindowArgs } from './meld-window'

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
}
