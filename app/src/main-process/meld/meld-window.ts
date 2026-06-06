import { BrowserWindow } from 'electron'
import * as path from 'path'

export interface IOpenMeldWindowArgs {
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: 'working' | 'commit' | 'merge'
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
  const query = new URLSearchParams({
    repositoryID: String(args.repositoryID),
    filePath: args.filePath,
    mode: args.mode,
  }).toString()

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
