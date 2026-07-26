import * as Path from 'path'
import type { Repository } from '../../models/repository'
import type { WorktreeEntry, WorktreeType } from '../../models/worktree'
import { git } from './core'

export function parseWorktreePorcelainOutput(
  stdout: string
): ReadonlyArray<WorktreeEntry> {
  if (stdout.trim().length === 0) {
    return []
  }

  // With -z, worktree blocks are separated by double NUL and fields within
  // a block are separated by single NUL
  const blocks = stdout.replace(/\0$/, '').split('\0\0')
  const entries: WorktreeEntry[] = []

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\0')
    let path = ''
    let head = ''
    let branch: string | null = null
    let isDetached = false
    let isLocked = false
    let isPrunable = false

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        // Git for Windows will output paths using forward slashes, i.e.
        // c:/Users/niik/... but repositories added in Desktop always pass
        // through getRepositoryType which uses path.resolve to deduce the
        // absolute top level directory and that will normalize paths as well
        // so by normalizing here we can be more confident about comparing paths
        path = Path.normalize(line.substring('worktree '.length))
      } else if (line.startsWith('HEAD ')) {
        head = line.substring('HEAD '.length)
      } else if (line.startsWith('branch ')) {
        branch = line.substring('branch '.length)
      } else if (line === 'detached') {
        isDetached = true
      } else if (line === 'locked' || line.startsWith('locked ')) {
        isLocked = true
      } else if (line === 'prunable' || line.startsWith('prunable ')) {
        isPrunable = true
      }
    }

    const type: WorktreeType = i === 0 ? 'main' : 'linked'
    entries.push({ path, head, branch, isDetached, type, isLocked, isPrunable })
  }

  return entries
}

export async function listWorktrees(
  repositoryOrPath: Repository | string
): Promise<ReadonlyArray<WorktreeEntry>> {
  const result = await git(
    ['worktree', 'list', '--porcelain', '-z'],
    typeof repositoryOrPath === 'string'
      ? repositoryOrPath
      : repositoryOrPath.path,
    'listWorktrees'
  )

  return parseWorktreePorcelainOutput(result.stdout)
}

export async function listWorktreesFromGitDir(
  gitDir: string
): Promise<ReadonlyArray<WorktreeEntry>> {
  const result = await git(
    ['--git-dir', gitDir, 'worktree', 'list', '--porcelain', '-z'],
    gitDir,
    'listWorktreesFromGitDir'
  )

  return parseWorktreePorcelainOutput(result.stdout)
}

export async function addWorktree(
  repository: Repository,
  path: string,
  options: {
    /** Branch name used with -b (create new branch) */
    readonly createBranch?: string
    /** Commit-ish to check out (branch name, ref, or SHA) */
    readonly commitish?: string
  } = {}
): Promise<void> {
  const args = ['worktree', 'add']

  if (options.createBranch) {
    args.push('-b', options.createBranch)
  }

  args.push(path)

  if (options.commitish) {
    args.push(options.commitish)
  }

  await git(args, repository.path, 'addWorktree')
}

export async function removeWorktree(
  repositoryPath: string,
  worktreePath: string,
  force: boolean = false
): Promise<void> {
  const args = ['worktree', 'remove']
  if (force) {
    args.push('--force')
  }
  args.push(worktreePath)

  await git(args, repositoryPath, 'removeWorktree')
}

export async function moveWorktree(
  repository: Repository,
  oldPath: string,
  newPath: string
): Promise<void> {
  await git(
    ['worktree', 'move', oldPath, newPath],
    repository.path,
    'moveWorktree'
  )
}

/** A worktree's dirty state, computed from `git status --porcelain`. */
export type WorktreeDirtyState = {
  readonly modifiedCount: number
  readonly untrackedCount: number
}

/** Lock a worktree, optionally with a human-readable reason. */
export async function lockWorktree(
  repository: Repository,
  worktreePath: string,
  reason?: string
): Promise<void> {
  const args = ['worktree', 'lock']
  if (reason && reason.length > 0) {
    args.push('--reason', reason)
  }
  args.push(worktreePath)
  await git(args, repository.path, 'lockWorktree')
}

/** Unlock a previously-locked worktree. */
export async function unlockWorktree(
  repository: Repository,
  worktreePath: string
): Promise<void> {
  await git(
    ['worktree', 'unlock', worktreePath],
    repository.path,
    'unlockWorktree'
  )
}

/**
 * Prune stale worktree administrative files. When `dryRun` is true, no
 * changes are written; the verbose output is parsed and the paths that
 * *would* be pruned are returned.
 *
 * Returns the list of paths pruned (or that would be pruned, on dry-run).
 */
export async function pruneWorktrees(
  repositoryOrPath: Repository | string,
  dryRun: boolean
): Promise<ReadonlyArray<string>> {
  const cwd =
    typeof repositoryOrPath === 'string'
      ? repositoryOrPath
      : repositoryOrPath.path
  const args = ['worktree', 'prune', '-v']
  if (dryRun) {
    args.splice(2, 0, '-n')
  }
  const staleWorktreePaths = (await listWorktrees(repositoryOrPath)).filter(
    worktree => worktree.isPrunable
  )
  const result = await git(args, cwd, 'pruneWorktrees')
  const parsedPaths = parsePruneVerboseOutput(
    `${result.stdout}\n${result.stderr}`
  )

  // Git writes prune diagnostics to stderr and, on current versions, reports
  // the administrative directory rather than the original worktree path. Use
  // the porcelain `prunable` entries captured before pruning as the fallback.
  return parsedPaths.length > 0
    ? parsedPaths
    : staleWorktreePaths.map(worktree => worktree.path)
}

/**
 * Parse the verbose output of `git worktree prune -v`. With `-v`, each
 * pruned entry is prefixed by `Removing worktrees/<dir>: ` followed by
 * the absolute path. On dry-run, the prefix is `Would remove worktrees/<dir>: `.
 *
 * Returns the absolute paths that were (or would be) pruned.
 */
export function parsePruneVerboseOutput(stdout: string): ReadonlyArray<string> {
  const paths: string[] = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }
    // Both "Removing worktrees/<basename>: <abs path>" and
    // "Would remove worktrees/<basename>: <abs path>" end with the same
    // "<basename>: <abs path>" suffix.
    const colon = trimmed.lastIndexOf(': ')
    if (colon === -1) {
      continue
    }
    const tail = trimmed.substring(colon + 2)
    if (Path.isAbsolute(tail)) {
      paths.push(tail)
    }
  }
  return paths
}

/**
 * Compute the dirty state of a worktree by running `git status --porcelain`
 * inside the worktree's directory. Returns zero counts if the worktree
 * directory is missing or not a git working tree. Errors from `git` are
 * swallowed by the caller via the AppStore's try/catch — zero counts are
 * the safe fallback.
 */
export async function getWorktreeDirtyState(
  worktreePath: string
): Promise<WorktreeDirtyState> {
  const result = await git(
    ['status', '--porcelain'],
    worktreePath,
    'getWorktreeDirtyState'
  )
  let modifiedCount = 0
  let untrackedCount = 0
  for (const line of result.stdout.split('\n')) {
    if (line.length === 0) {
      continue
    }
    // `git status --porcelain` produces lines of the form `XY <path>` where
    // X is the staged status and Y is the unstaged status. An entry is
    // untracked only when XY is `??`.
    if (line.startsWith('??')) {
      untrackedCount++
    } else {
      modifiedCount++
    }
  }
  return { modifiedCount, untrackedCount }
}
