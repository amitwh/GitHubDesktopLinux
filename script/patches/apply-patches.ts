import * as Path from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

// repo root: this file lives at <root>/script/patches/
const root = Path.join(__dirname, '..', '..')

/** Outcome of a single patch application attempt. */
export type PatchResult = 'patched' | 'already-clean' | 'module-not-found'

/**
 * electron-builder's snap target (app-builder-lib, legacy template path)
 * deletes `chrome-sandbox` from the app output directory before running
 * mksquashfs:
 *
 *   // Best-effort: remove chrome-sandbox from app dir before mksquashfs scans it.
 *   await rm(path.join(appOutDir, "chrome-sandbox"), { force: true });
 *
 * That deletion is redundant even for the snap itself — the same function
 * already excludes the file from the mksquashfs arguments and passes
 * `--exclude chrome-sandbox` — but it mutates the directory that is
 * SHARED with every sibling target. electron-builder v26 builds Linux
 * targets in parallel, so when `--prepackaged dist/...` is used the snap
 * task can delete the file between the deb task's directory scan and its
 * `stat` of the file, killing the whole packaging run with
 *
 *   ENOENT: no such file or directory, stat 'dist/.../chrome-sandbox'
 *
 * and otherwise racing the deb so it ships without the SUID sandbox
 * helper at all. We therefore strip those two lines from the compiled
 * `coreLegacy.js` after `yarn install`.
 *
 * The match is deliberately narrow: if a future app-builder-lib version
 * removes or restructures the code, the patch becomes a no-op
 * (`already-clean`) rather than a hard failure, and the snap still works
 * because the exclusion filter above is what actually keeps the file out
 * of the snap payload.
 */
const snapChromeSandboxDeletion =
  /[ \t]*\/\/ Best-effort: remove chrome-sandbox from app dir before mksquashfs scans it\.[\r\n]+[ \t]*await \(0, promises_1\.rm\)\(path\.join\(appOutDir, "chrome-sandbox"\), \{ force: true \}\);[\r\n]+/

/**
 * Returns the input with the snap target's chrome-sandbox deletion
 * removed, or null when there is nothing to remove.
 */
export function removeSnapChromeSandboxDeletion(
  contents: string
): string | null {
  if (!snapChromeSandboxDeletion.test(contents)) {
    return null
  }

  return contents.replace(snapChromeSandboxDeletion, '')
}

function getSnapCoreLegacyPath() {
  return Path.join(
    root,
    'node_modules',
    'app-builder-lib',
    'out',
    'targets',
    'snap',
    'coreLegacy.js'
  )
}

/**
 * Applies the snap chrome-sandbox patch to the file at `filePath`
 * (defaults to the installed app-builder-lib copy). Safe to run any
 * number of times.
 */
export function applySnapChromeSandboxDeletionPatch(
  filePath: string = getSnapCoreLegacyPath()
): PatchResult {
  if (!existsSync(filePath)) {
    return 'module-not-found'
  }

  const contents = readFileSync(filePath, 'utf8')
  const patched = removeSnapChromeSandboxDeletion(contents)

  if (patched === null) {
    return 'already-clean'
  }

  writeFileSync(filePath, patched)
  return 'patched'
}

/**
 * Entry point for script/post-install.ts — applies every node_modules
 * patch this fork carries.
 */
export function applyNodeModulePatches() {
  const result = applySnapChromeSandboxDeletionPatch()

  switch (result) {
    case 'patched':
      console.log(
        'Patched app-builder-lib: snap target no longer deletes chrome-sandbox from the shared app dir.'
      )
      break
    case 'already-clean':
      console.log(
        'app-builder-lib snap target already clean (chrome-sandbox deletion absent).'
      )
      break
    case 'module-not-found':
      console.warn(
        'app-builder-lib not found — skipping snap chrome-sandbox patch. ' +
          'Parallel Linux packaging may race over chrome-sandbox.'
      )
      break
  }
}
