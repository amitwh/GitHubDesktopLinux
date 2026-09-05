import { IMenuItemState } from './menu-update'
import { MenuIDs } from '../models/menu-ids'
import { ISerializableMenuItem } from './menu-item'
import { MenuLabelsEvent } from '../models/menu-labels'
import { MenuEvent } from '../main-process/menu'
import { LogLevel } from './logging/log-level'
import { ICrashDetails } from '../crash/shared'
import { WindowState } from './window-state'
import { IMenu } from '../models/app-menu'
import { ILaunchStats } from './stats'
import { URLActionType } from './parse-app-url'
import { Architecture } from './get-architecture'
import { EndpointToken } from './endpoint-token'
import { PathType } from '../ui/lib/app-proxy'
import { ThemeSource } from '../ui/lib/theme-source'
import { DesktopNotificationPermission } from 'desktop-notifications'
import { NotificationCallback } from 'desktop-notifications'
import { DesktopAliveEvent } from './stores/alive-store'
import { CLIAction } from './cli-action'

/**
 * Shape used to communicate the most-recently-opened repositories from the
 * renderer to the main process. Only used by the Linux File menu's
 * `Open Recent ▸` submenu; the renderer has the source of truth for the
 * recent-repositories list and pushes entries here whenever it changes.
 */
export interface IRecentRepositoryMenuEntry {
  readonly id: number
  readonly name: string
  readonly path: string
}

/**
 * Defines the simplex IPC channel names we use from the renderer
 * process along with their signatures. This type is used from both
 * the renderer and the main process to ensure a common contract between
 * the two over the untyped IPC framework.
 */
export type RequestChannels = {
  'select-all-window-contents': () => void
  'dialog-did-open': () => void
  'update-menu-state': (
    state: Array<{ id: MenuIDs; state: IMenuItemState }>
  ) => void
  'renderer-ready': (time: number) => void
  'execute-menu-item-by-id': (id: string) => void
  'show-certificate-trust-dialog': (
    certificate: Electron.Certificate,
    message: string
  ) => void
  'get-app-menu': () => void
  'update-preferred-app-menu-item-labels': (labels: MenuLabelsEvent) => void
  'uncaught-exception': (error: Error) => void
  'send-error-report': (
    error: Error,
    extra: Record<string, string>,
    nonFatal: boolean
  ) => void
  'unsafe-open-directory': (path: string) => void
  'menu-event': (name: MenuEvent) => void
  // Linux File menu: Open Recent submenu — renderer pushes the recent
  // repository list (id, name, path) so the main process can render a
  // dynamic submenu. Items are also disabled when no entries exist.
  'update-recent-repositories-for-menu': (
    entries: ReadonlyArray<IRecentRepositoryMenuEntry>
  ) => void
  // Linux File menu: Close Repository / Open Recent clicks — the main
  // process sends these to the renderer with an optional path argument
  // (path is only populated for `open-recent-repository`).
  'close-repository': () => void
  'open-recent-repository': (path: string) => void
  log: (level: LogLevel, message: string) => void
  'will-quit': () => void
  'will-quit-even-if-updating': () => void
  'cancel-quitting': () => void
  'crash-ready': () => void
  'crash-quit': () => void
  'window-state-changed': (windowState: WindowState) => void
  error: (crashDetails: ICrashDetails) => void
  'zoom-factor-changed': (zoomFactor: number) => void
  'app-menu': (menu: IMenu) => void
  'launch-timing-stats': (stats: ILaunchStats) => void
  'url-action': (action: URLActionType) => void
  'cli-action': (action: CLIAction) => void
  'certificate-error': (
    certificate: Electron.Certificate,
    error: string,
    url: string
  ) => void
  focus: () => void
  blur: () => void
  'update-accounts': (accounts: ReadonlyArray<EndpointToken>) => void
  'quit-and-install-updates': () => void
  'quit-app': () => void
  'minimize-window': () => void
  'maximize-window': () => void
  'unmaximize-window': () => void
  'close-window': () => void
  'auto-updater-error': (error: Error) => void
  'auto-updater-checking-for-update': () => void
  'auto-updater-update-available': () => void
  'auto-updater-update-not-available': () => void
  'auto-updater-update-downloaded': () => void
  'native-theme-updated': () => void
  'set-native-theme-source': (themeName: ThemeSource) => void
  'update-window-background-color': (color: string) => void
  'focus-window': () => void
  'notification-event': NotificationCallback<DesktopAliveEvent>
  'set-window-zoom-factor': (zoomFactor: number) => void
  'show-installing-update': () => void
  'install-windows-cli': () => void
  'uninstall-windows-cli': () => void
  'view:toggle-word-wrap': () => void
  'view:toggle-line-numbers': () => void
  'view:reset-layout': () => void
}

/**
 * Defines the duplex IPC channel names we use from the renderer
 * process along with their signatures. This type is used from both
 * the renderer and the main process to ensure a common contract between
 * the two over the untyped IPC framework.
 *
 * Return signatures must be promises
 */
export type RequestResponseChannels = {
  'get-path': (path: PathType) => Promise<string>
  'get-app-architecture': () => Promise<Architecture>
  'get-app-path': () => Promise<string>
  'get-exec-path': () => Promise<string>
  'is-running-under-arm64-translation': () => Promise<boolean>
  'move-to-trash': (path: string) => Promise<void>
  'show-item-in-folder': (path: string) => Promise<void>
  'write-clipboard-text': (text: string) => Promise<void>
  'show-contextual-menu': (
    items: ReadonlyArray<ISerializableMenuItem>,
    addSpellCheckMenu: boolean
  ) => Promise<ReadonlyArray<number> | null>
  'is-window-focused': () => Promise<boolean>
  'open-external': (path: string) => Promise<boolean>
  'is-in-application-folder': () => Promise<boolean | null>
  'move-to-applications-folder': () => Promise<void>
  'check-for-updates': (url: string) => Promise<Error | undefined>
  'get-current-window-state': () => Promise<WindowState | undefined>
  'get-current-window-zoom-factor': () => Promise<number | undefined>
  'resolve-proxy': (url: string) => Promise<string>
  'show-save-dialog': (
    options: Electron.SaveDialogOptions
  ) => Promise<string | null>
  'show-open-dialog': (
    options: Electron.OpenDialogOptions
  ) => Promise<string | null>
  'is-window-maximized': () => Promise<boolean>
  'get-apple-action-on-double-click': () => Promise<Electron.AppleActionOnDoubleClickPref>
  'should-use-dark-colors': () => Promise<boolean>
  'save-guid': (guid: string) => Promise<void>
  'get-guid': () => Promise<string>
  'show-notification': (
    title: string,
    body: string,
    userInfo?: DesktopAliveEvent
  ) => Promise<string | null>
  'get-notifications-permission': () => Promise<DesktopNotificationPermission>
  'request-notifications-permission': () => Promise<boolean>
  // Meld window Phase 1a channels — defined here for type-safe IPC.
  'meld:list-tools': () => Promise<ReadonlyArray<unknown>>
  'meld:launch-external-tool': (req: unknown) => Promise<{
    success: boolean
    error?: string
  }>
  'meld:open-window': (args: unknown) => Promise<{ sessionID: string }>
  'meld:save-edits': () => Promise<{ success: boolean; error?: string }>
  // Phase 1c: three-way auto-merge via git merge-file
  'meld:auto-merge': (req: unknown) => Promise<{
    mergedContent: string
    clean: boolean
    conflictCount: number
  }>
  // Phase 2 (T1, BlameGutter): fetch blame information for a file
  'meld:get-blame': (req: unknown) => Promise<ReadonlyArray<unknown>>
  // Phase 2 (T2, MeldStashView): list all stashes and the files in a stash
  'meld:list-stashes': (req: unknown) => Promise<ReadonlyArray<unknown>>
  'meld:get-stash-files': (req: unknown) => Promise<ReadonlyArray<unknown>>
  // Phase 2 (T3, MeldSubmoduleView): list submodules and their diffs
  'meld:list-submodules': (req: unknown) => Promise<ReadonlyArray<unknown>>
  'meld:get-submodule-diff': (req: unknown) => Promise<string>
  // Phase 3 (Rebase Preview): per-commit stats + diff for the
  // interactive-rebase planner. Both return zero/empty on failure so
  // the dialog never blocks waiting on git.
  'meld:get-rebase-commit-stats': (req: unknown) => Promise<{
    readonly filesChanged: number
    readonly insertions: number
    readonly deletions: number
  }>
  'meld:get-rebase-commit-diff': (req: unknown) => Promise<string>
  // Worktree Phase 1: compute disk usage for a set of worktree paths so
  // the renderer never blocks the list rendering on the file-system walk.
  // The handler is best-effort — missing paths yield `null` entries.
  'worktree:compute-sizes': (req: {
    paths: ReadonlyArray<string>
  }) => Promise<{
    sizes: ReadonlyArray<{ path: string; size: number } | null>
  }>
}
