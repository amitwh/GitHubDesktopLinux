import { git, IGitStringExecutionOptions } from './core'
import { Repository } from '../../models/repository'
import { SubmoduleEntry } from '../../models/submodule'
import { pathExists } from '../path-exists'
import { executionOptionsWithProgress, IGitOutput } from '../progress'
import {
  envForRemoteOperation,
  getFallbackUrlForProxyResolve,
} from './environment'
import { AuthenticationErrors } from './authentication'
import { IRemote } from '../../models/remote'
import { Progress } from '../../models/progress'
import { join, resolve } from 'path'
import { readFile } from 'fs/promises'

/**
 * Update submodules after a git operation.
 *
 * @param repository - The repository in which to update submodules
 * @param remote - The remote for environment setup (can be null)
 * @param progressCallback - An optional function which will be invoked
 *                           with information about the current progress
 *                           of the submodule update operation.
 * @param progressKind - The kind of progress event ('checkout', 'pull', etc.)
 * @param title - The title to use for progress reporting
 * @param targetOrRemote - The target (for checkout) or remote name (for pull)
 * @param allowFileProtocol - Whether to allow file:// protocol for submodules
 */
export async function updateSubmodulesAfterOperation<T extends Progress>(
  repository: Repository,
  remote: IRemote | null,
  progressCallback: ((progress: T) => void) | undefined,
  progressKind: T['kind'],
  title: string,
  targetOrRemote: string,
  allowFileProtocol: boolean
): Promise<void> {
  const opts: IGitStringExecutionOptions = {
    env: await envForRemoteOperation(
      getFallbackUrlForProxyResolve(repository, remote)
    ),
    expectedErrors: AuthenticationErrors,
  }

  const args = [
    ...(allowFileProtocol ? ['-c', 'protocol.file.allow=always'] : []),
    'submodule',
    'update',
    '--init',
    '--recursive',
  ]

  if (!progressCallback) {
    await git(args, repository.path, 'updateSubmodules', opts)
    return
  }

  // Initial progress
  progressCallback({
    kind: progressKind,
    title,
    description: 'Updating submodules',
    value: 0,
    // Add the target or remote field based on the progress kind
    ...(progressKind === 'checkout'
      ? { target: targetOrRemote }
      : { remote: targetOrRemote }),
  } as T)

  let submoduleEventCount = 0

  const progressOpts = await executionOptionsWithProgress(
    { ...opts, trackLFSProgress: true },
    {
      parse(line: string): IGitOutput {
        if (
          line.match(/^Submodule path (.)+?: checked out /) ||
          line.startsWith('Cloning into ')
        ) {
          submoduleEventCount += 1
        }

        return {
          kind: 'context',
          text: `Updating submodules: ${line}`,
          // Math taken from https://math.stackexchange.com/a/2323106
          // We do this to fake a progress that slows down as we process more
          // events, as we don't know how many submodules there are upfront, or
          // what does git have to do with them (cloning, just checking them
          // out...)
          percent: 1 - Math.exp(-submoduleEventCount * 0.25),
        }
      },
    },
    progress => {
      const description =
        progress.kind === 'progress' ? progress.details.text : progress.text

      const value = progress.percent

      progressCallback({
        kind: progressKind,
        title,
        description,
        value,
        ...(progressKind === 'checkout'
          ? { target: targetOrRemote }
          : { remote: targetOrRemote }),
      } as T)
    }
  )

  await git(args, repository.path, 'updateSubmodules', progressOpts)

  // Final progress
  progressCallback({
    kind: progressKind,
    title,
    description: 'Submodules updated',
    value: 1,
    ...(progressKind === 'checkout'
      ? { target: targetOrRemote }
      : { remote: targetOrRemote }),
  } as T)
}

export async function listSubmodules(
  repository: Repository
): Promise<ReadonlyArray<SubmoduleEntry>> {
  const [submodulesFile, submodulesDir] = await Promise.all([
    pathExists(join(repository.path, '.gitmodules')),
    pathExists(join(repository.path, '.git', 'modules')),
  ])

  if (!submodulesFile && !submodulesDir) {
    // repo path + .gitmodules and + .git/modules covers the vast majority of
    // "normal" repositories but if we're in a linked worktree the modules
    // directory is actually in the git common dir so we'll also check for the
    // existence of the modules directory there as well before giving up on the
    // existence of submodules in this repo. We're reading the commondir file
    // ourselves here instead of calling out to git to avoid the cost of
    // spawning a process on Windows
    const commonDirPath = join(repository.resolvedGitDir, 'commondir')
    const commonDir = await readFile(commonDirPath, 'utf8')
      .then(content => content.replace(/\r?\n$/, ''))
      .then(p => (p ? resolve(repository.resolvedGitDir, p) : null))
      .catch(() => null)

    if (!commonDir || !(await pathExists(join(commonDir, 'modules')))) {
      log.info('No submodules found. Skipping "git submodule status"')
      return []
    }
  }

  // We don't recurse when listing submodules here because we don't have a good
  // story about managing these currently. So for now we're only listing
  // changes to the top-level submodules to be consistent with `git status`
  const { stdout, exitCode } = await git(
    ['submodule', 'status', '--'],
    repository.path,
    'listSubmodules',
    { successExitCodes: new Set([0, 128]) }
  )

  if (exitCode === 128) {
    // unable to parse submodules in repository, giving up
    return []
  }

  const submodules = new Array<SubmoduleEntry>()

  // entries are of the format:
  //  1eaabe34fc6f486367a176207420378f587d3b48 git (v2.16.0-rc0)
  //
  // first character:
  //   - " " if no change
  //   - "-" if the submodule is not initialized
  //   - "+" if the currently checked out submodule commit does not match the SHA-1 found in the index of the containing repository
  //   - "U" if the submodule has merge conflicts
  //
  // then the 40-character SHA represents the current commit
  //
  // then the path to the submodule
  //
  // then the output of `git describe` for the submodule in braces
  // we're not leveraging this in the app, so go and read the docs
  // about it if you want to learn more:
  //
  // https://git-scm.com/docs/git-describe
  const statusRe = /^.([^ ]+) (.+) \((.+?)\)$/gm

  for (const [, sha, path, describe] of stdout.matchAll(statusRe)) {
    submodules.push(new SubmoduleEntry(sha, path, describe))
  }

  return submodules
}

export async function resetSubmodulePaths(
  repository: Repository,
  paths: ReadonlyArray<string>
): Promise<void> {
  if (paths.length === 0) {
    return
  }

  await git(
    ['submodule', 'update', '--recursive', '--force', '--', ...paths],
    repository.path,
    'updateSubmodule'
  )
}

export interface ISubmodule {
  readonly path: string
  readonly url: string
  readonly sha: string
}

export async function getSubmodules(
  repository: Repository
): Promise<ReadonlyArray<ISubmodule>> {
  const result = await git(
    ['submodule', 'status'],
    repository.path,
    'getSubmodules',
    { successExitCodes: new Set([0, 128]) }
  )

  if (result.exitCode === 128) {
    return []
  }

  const lines = result.stdout.split('\n')
  const submodules: ISubmodule[] = []

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 2) {
      const sha = parts[0].replace(/^[-+U]/, '')
      const path = parts[1]
      submodules.push({ sha, path, url: '' })
    }
  }

  return submodules
}

export async function updateSubmodule(
  repository: Repository,
  path: string
): Promise<void> {
  await git(
    ['submodule', 'update', '--init', '--recursive', '--', path],
    repository.path,
    'updateSubmodule'
  )
}

export async function syncSubmodule(
  repository: Repository,
  path: string
): Promise<void> {
  await git(
    ['submodule', 'sync', '--recursive', '--', path],
    repository.path,
    'syncSubmodule'
  )
}

/**
 * Phase 2 (T3, MeldSubmoduleView): a coarse-grained status indicator
 * for a submodule entry. The status is derived from the leading
 * character in `git submodule status`:
 *
 *   - " " (space) → clean: HEAD matches the SHA recorded in the parent
 *     repository's index and the submodule working tree is clean.
 *   - "+" → modified: HEAD matches the parent's index SHA but the
 *     submodule working tree has uncommitted changes (the index and
 *     the working tree differ).
 *   - "-" → uninitialized: the submodule directory exists but is not
 *     initialized (`git submodule update --init` has not been run).
 *   - "U" → conflicted: merge conflicts inside the submodule.
 *
 * Anything else (including the absent-status case) falls through to
 * `clean` so the UI can always render a deterministic badge.
 */
export type ISubmoduleCoarseStatus = 'clean' | 'modified' | 'uninitialized'

export interface ISubmoduleStatusEntry {
  readonly path: string
  readonly sha: string
  readonly status: ISubmoduleCoarseStatus
}

/**
 * Phase 2 (T3, MeldSubmoduleView): list submodules with a coarse
 * status indicator suitable for the Meld file tree. Wraps
 * `git submodule status` and returns an empty array on a non-zero
 * exit (no submodules, unborn HEAD, or not-a-git-repo).
 *
 * The status indicator is intentionally simple: clean / modified /
 * uninitialized. The richer per-submodule status that the existing
 * `listSubmodules` parser produces (with `describe` output and
 * 40-char SHAs) is too noisy for the file-tree sidebar.
 */
export async function getSubmoduleStatus(
  repository: Repository
): Promise<ReadonlyArray<ISubmoduleStatusEntry>> {
  const result = await git(
    ['submodule', 'status'],
    repository.path,
    'getSubmoduleStatus',
    { successExitCodes: new Set([0, 128]) }
  )

  if (result.exitCode === 128 || result.stdout.trim() === '') {
    return []
  }

  const entries: ISubmoduleStatusEntry[] = []
  for (const rawLine of result.stdout.split('\n')) {
    const line = rawLine.trimEnd()
    if (line === '') {
      continue
    }
    const first = line.charAt(0)
    let status: ISubmoduleCoarseStatus
    if (first === '+') {
      status = 'modified'
    } else if (first === '-') {
      status = 'uninitialized'
    } else {
      // " " (clean), "U" (conflict), or anything else — render as
      // clean. The tree badge is purely visual.
      status = 'clean'
    }
    // Strip leading marker char to get the 40-char SHA, then the path.
    const remainder = line.substring(1).trimStart()
    const parts = remainder.split(/\s+/)
    const sha = parts[0] ?? ''
    const path = parts[1] ?? ''
    if (sha === '' || path === '') {
      continue
    }
    entries.push({ path, sha, status })
  }

  return entries
}

/**
 * Phase 2 (T3, MeldSubmoduleView): get the unified diff for a single
 * submodule against the parent's recorded SHA. Returns the empty
 * string when the submodule has no diff or git could not produce one
 * (e.g. uninitialized submodule — `git diff` would otherwise throw).
 *
 * The output is the standard unified diff format produced by
 * `git diff --submodule=log` for textual content (submodules with
 * tracked files). For binary-only submodules the diff is empty by
 * design — the file tree already shows the status badge so the user
 * knows the submodule is dirty.
 */
export async function getSubmoduleDiff(
  repository: Repository,
  submodulePath: string
): Promise<string> {
  try {
    const result = await git(
      ['diff', '--submodule=log', '--', submodulePath],
      repository.path,
      'getSubmoduleDiff'
    )
    return result.stdout
  } catch {
    return ''
  }
}
