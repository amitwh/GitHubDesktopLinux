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

export const useMeldForDiffKey = 'use-meld-for-diff'
export const useMeldForDiffDefault = false
export const useMeldForMergeKey = 'use-meld-for-merge'
export const useMeldForMergeDefault = true
export const fallbackToInlineDiffKey = 'fallback-to-inline-diff'
export const fallbackToInlineDiffDefault = true
export const confirmShellOpenKey = 'confirm-shell-open'
export const confirmShellOpenDefault = false
export const openShellOnRepoOpenKey = 'open-shell-on-repo-open'
export const openShellOnRepoOpenDefault = false
export const customShellPathKey = 'custom-shell-path'
export const customShellPathDefault = ''

/**
 * When `true`, Electron is started with hardware acceleration disabled on the
 * next launch. Useful as a recovery option when a faulty GPU driver crashes
 * the renderer. Defaults to `false`. Requires an app restart to take effect,
 * which is why this lives in the Performance tab rather than being a runtime
 * toggle.
 */
export const disableHardwareAccelerationKey = 'disable-hardware-acceleration'
export const disableHardwareAccelerationDefault = false

/**
 * When `true`, list virtualization tries to keep the visible rows mounted
 * across the duration of a scroll gesture so the renderer doesn't show empty
 * gaps during a fast fling. Defaults to `true`. Stage 2B records the user
 * intent; downstream code can read the key and act on it.
 */
export const enableSmoothScrollingKey = 'enable-smooth-scrolling'
export const enableSmoothScrollingDefault = true

/**
 * When `true`, the Git operation queue caps the number of concurrent git
 * processes to a small fixed number (4) to keep large multi-repo workspaces
 * responsive. The actual concurrency limiter is wired in a follow-up slice.
 */
export const limitConcurrentGitOpsKey = 'limit-concurrent-git-ops'
export const limitConcurrentGitOpsDefault = true

/**
 * Background fetch interval (minutes) — controls how often the background
 * fetcher wakes up to refresh the selected repository. Persisted as a number;
 * the UI exposes a curated set of choices (5/15/30/60).
 */
export const maxBackgroundFetchIntervalKey = 'max-background-fetch-interval'
export const maxBackgroundFetchIntervalDefault = 15

/**
 * When `true`, the renderer enables performance tracing (Chromium tracing
 * categories, mostly useful when debugging jank). Defaults to `false`.
 */
export const enablePerfTracingKey = 'enable-perf-tracing'
export const enablePerfTracingDefault = false
