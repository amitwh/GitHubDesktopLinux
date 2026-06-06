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

  ipcMain.handle('meld:open-window', async (_event, args: IOpenMeldWindowArgs) => {
    const sessionID = openMeldWindow(args)
    return { sessionID }
  })

  ipcMain.handle('meld:launch-external-tool', async (_event, req: ILaunchToolRequest) => {
    const args = substituteArgs(req.tool, {
      leftPath: req.leftPath,
      rightPath: req.rightPath,
      basePath: req.basePath,
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
}
