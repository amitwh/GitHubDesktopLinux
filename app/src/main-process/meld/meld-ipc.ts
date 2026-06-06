import * as ipcMain from '../ipc-main'
import { spawn } from 'child_process'
import { getDefaultExternalTools } from '../../lib/meld/default-tools'
import { substituteArgs } from '../../lib/meld/external-tool-args'
import { IExternalTool } from '../../models/external-tool'
import { openMeldWindow, IOpenMeldWindowArgs } from './meld-window'

interface ILaunchToolRequest {
  readonly tool: IExternalTool
  readonly leftPath: string
  readonly rightPath: string
  readonly basePath?: string
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
}
