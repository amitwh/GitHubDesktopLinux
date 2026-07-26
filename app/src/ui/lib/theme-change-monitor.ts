import {
  ApplicableTheme,
  getCurrentlyAppliedTheme,
  supportsSystemThemeChanges,
} from './application-theme'
import { Disposable, Emitter } from 'event-kit'
import { onNativeThemeUpdated } from '../main-process-proxy'

class ThemeChangeMonitor {
  private readonly emitter = new Emitter()

  public constructor() {
    // This module is imported by both the renderer and the main process (via
    // app-store → notifications → alive-store → accounts-store → stores barrel).
    // `ipcRenderer` only exists in the renderer, so skip the subscription when
    // running in the main process.
    if (typeof window === 'undefined') {
      return
    }
    this.subscribe()
  }

  private subscribe = () => {
    if (!supportsSystemThemeChanges()) {
      return
    }

    onNativeThemeUpdated(this.onThemeNotificationUpdated)
  }

  private onThemeNotificationUpdated = async () => {
    const theme = await getCurrentlyAppliedTheme()
    this.emitThemeChanged(theme)
  }

  public onThemeChanged(fn: (theme: ApplicableTheme) => void): Disposable {
    return this.emitter.on('theme-changed', fn)
  }

  private emitThemeChanged(theme: ApplicableTheme) {
    this.emitter.emit('theme-changed', theme)
  }
}

// this becomes our singleton that we can subscribe to from anywhere
export const themeChangeMonitor = new ThemeChangeMonitor()
