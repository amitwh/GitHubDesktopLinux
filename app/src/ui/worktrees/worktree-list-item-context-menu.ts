import * as Path from 'path'

import { IMenuItem } from '../../lib/menu-item'
import { writeClipboardText } from '../main-process-proxy'

interface IWorktreeContextMenuConfig {
  readonly path: string
  readonly isMainWorktree: boolean
  readonly isLocked: boolean
  readonly onRenameWorktree?: (path: string) => void
  readonly onRemoveWorktree?: (path: string) => void
  readonly onLockWorktree?: (path: string) => void
  readonly onUnlockWorktree?: (path: string) => void
}

export function generateWorktreeContextMenuItems(
  config: IWorktreeContextMenuConfig
): ReadonlyArray<IMenuItem> {
  const {
    path,
    isMainWorktree,
    isLocked,
    onRenameWorktree,
    onRemoveWorktree,
    onLockWorktree,
    onUnlockWorktree,
  } = config
  const name = Path.basename(path)
  const items = new Array<IMenuItem>()

  if (onRenameWorktree !== undefined) {
    items.push({
      label: 'Rename…',
      action: () => onRenameWorktree(path),
      enabled: !isMainWorktree && !isLocked,
    })
  }

  items.push({
    label: __DARWIN__ ? 'Copy Worktree Name' : 'Copy worktree name',
    action: () => writeClipboardText(name),
  })

  items.push({
    label: __DARWIN__ ? 'Copy Worktree Path' : 'Copy worktree path',
    action: () => writeClipboardText(path),
  })

  items.push({ type: 'separator' })

  if (!isMainWorktree) {
    if (onLockWorktree !== undefined) {
      items.push({
        label: __DARWIN__ ? 'Lock…' : 'Lock…',
        action: () => onLockWorktree(path),
        enabled: !isLocked,
      })
    }

    if (onUnlockWorktree !== undefined) {
      items.push({
        label: __DARWIN__ ? 'Unlock' : 'Unlock',
        action: () => onUnlockWorktree(path),
        enabled: isLocked,
      })
    }
  }

  if (onRemoveWorktree !== undefined) {
    items.push({
      label: 'Delete…',
      action: () => onRemoveWorktree(path),
      enabled: !isMainWorktree && !isLocked,
    })
  }

  return items
}
