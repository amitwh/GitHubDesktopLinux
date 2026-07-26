/**
 * Preference key constants shared between the main process (used by the stats
 * store) and the renderer (used by AppStore). Lives outside `lib/stores/` so
 * main-process code can import these without pulling in the renderer-only
 * `app-store.ts` (and its side-effectful imports on `localStorage`/`window`)
 * through the stores barrel.
 */

export const useCustomEditorKey = 'use-custom-editor'
export const useCustomShellKey = 'use-custom-shell'
export const underlineLinksKey = 'underline-links'
export const underlineLinksDefault = true

export const showDiffCheckMarksDefault = true
export const showDiffCheckMarksKey = 'diff-check-marks-visible'

export const showChangesFilterKey = 'show-changes-filter'
export const showChangesFilterDefault = true

export const wordWrapKey = 'word-wrap'
export const wordWrapDefault = true

export const showLineNumbersKey = 'diff-line-numbers-visible'
export const showLineNumbersDefault = true

export const useSSHDefaultKey = 'use-ssh-default'
export const useSSHDefaultDefault = false

export const autoFetchOnFocusKey = 'auto-fetch-on-focus'
export const autoFetchOnFocusDefault = false
