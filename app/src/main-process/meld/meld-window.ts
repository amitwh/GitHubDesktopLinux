import { BrowserWindow } from 'electron'
import * as path from 'path'

export interface IOpenMeldWindowArgs {
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: 'working' | 'commit' | 'merge'
  /**
   * Phase 1c merge mode: SHA of the common ancestor (BASE). Optional
   * because working/commit modes don't need it. The renderer uses
   * this to call `readThreeWayContents` on mount.
   */
  readonly mergeBaseSha?: string
  /**
   * Phase 1c merge mode: SHA of the incoming branch tip (THEIRS).
   * Optional for the same reason as `mergeBaseSha`.
   */
  readonly theirsSha?: string
}

const openWindows = new Map<string, BrowserWindow>()

function sessionKey(args: IOpenMeldWindowArgs): string {
  return `${args.repositoryID}:${args.filePath}:${args.mode}`
}

export function openMeldWindow(args: IOpenMeldWindowArgs): string {
  const key = sessionKey(args)
  const existing = openWindows.get(key)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return key
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: `Meld — ${path.basename(args.filePath)}`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
    },
  })

  // Build the URL hash with query string for the renderer to pick up
  const queryParams: Record<string, string> = {
    repositoryID: String(args.repositoryID),
    filePath: args.filePath,
    mode: args.mode,
  }
  if (args.mergeBaseSha !== undefined) {
    queryParams.mergeBaseSha = args.mergeBaseSha
  }
  if (args.theirsSha !== undefined) {
    queryParams.theirsSha = args.theirsSha
  }
  const query = new URLSearchParams(queryParams).toString()

  // Load the existing app's index.html with a special hash route.
  // The renderer (Task 17) detects the hash and mounts <MeldWindow>.
  win.loadFile(path.join(__dirname, '../../index.html'), {
    hash: `meld?${query}`,
  })

  win.on('closed', () => {
    openWindows.delete(key)
  })

  openWindows.set(key, win)
  return key
}

export function getOpenMeldWindows(): ReadonlyArray<BrowserWindow> {
  return Array.from(openWindows.values()).filter(w => !w.isDestroyed())
}
