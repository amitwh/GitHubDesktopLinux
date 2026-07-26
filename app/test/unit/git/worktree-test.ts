import assert from 'node:assert'
import * as Path from 'path'
import { realpath, rm } from 'fs/promises'
import { describe, it } from 'node:test'
import { exec } from 'dugite'
import { setupEmptyRepository } from '../../helpers/repositories'
import { makeCommit } from '../../helpers/repository-scaffolding'
import {
  parseWorktreePorcelainOutput,
  parsePruneVerboseOutput,
  listWorktrees,
  listWorktreesFromGitDir,
  addWorktree,
  lockWorktree,
  unlockWorktree,
  pruneWorktrees,
  getWorktreeDirtyState,
} from '../../../src/lib/git'

describe('git/worktree', () => {
  describe('parseWorktreePorcelainOutput', () => {
    it('returns empty array for empty output', () => {
      assert.deepStrictEqual(parseWorktreePorcelainOutput(''), [])
      assert.deepStrictEqual(parseWorktreePorcelainOutput('  \n  '), [])
    })

    it('parses a single main worktree', () => {
      const output =
        [
          'worktree /path/to/repo',
          'HEAD abc1234abc1234abc1234abc1234abc1234abc123',
          'branch refs/heads/main',
        ].join('\0') + '\0'

      const entries = parseWorktreePorcelainOutput(output)
      assert.strictEqual(entries.length, 1)
      assert.deepStrictEqual(entries[0], {
        path: Path.normalize('/path/to/repo'),
        head: 'abc1234abc1234abc1234abc1234abc1234abc123',
        branch: 'refs/heads/main',
        isDetached: false,
        type: 'main',
        isLocked: false,
        isPrunable: false,
      })
    })

    it('parses multiple worktrees', () => {
      const output =
        [
          [
            'worktree /path/to/repo',
            'HEAD abc1234abc1234abc1234abc1234abc1234abc123',
            'branch refs/heads/main',
          ].join('\0'),
          [
            'worktree /path/to/linked',
            'HEAD def5678def5678def5678def5678def5678def567',
            'branch refs/heads/feature',
          ].join('\0'),
        ].join('\0\0') + '\0'

      const entries = parseWorktreePorcelainOutput(output)
      assert.strictEqual(entries.length, 2)

      assert.strictEqual(entries[0].type, 'main')
      assert.strictEqual(entries[0].path, Path.normalize('/path/to/repo'))

      assert.strictEqual(entries[1].type, 'linked')
      assert.strictEqual(entries[1].path, Path.normalize('/path/to/linked'))
      assert.strictEqual(entries[1].branch, 'refs/heads/feature')
    })

    it('parses detached HEAD worktree', () => {
      const output =
        [
          [
            'worktree /path/to/repo',
            'HEAD abc1234abc1234abc1234abc1234abc1234abc123',
            'branch refs/heads/main',
          ].join('\0'),
          [
            'worktree /path/to/detached',
            'HEAD def5678def5678def5678def5678def5678def567',
            'detached',
          ].join('\0'),
        ].join('\0\0') + '\0'

      const entries = parseWorktreePorcelainOutput(output)
      assert.strictEqual(entries.length, 2)

      assert.strictEqual(entries[1].isDetached, true)
      assert.strictEqual(entries[1].branch, null)
    })

    it('parses locked worktree', () => {
      const output =
        [
          [
            'worktree /path/to/repo',
            'HEAD abc1234abc1234abc1234abc1234abc1234abc123',
            'branch refs/heads/main',
          ].join('\0'),
          [
            'worktree /path/to/locked-wt',
            'HEAD def5678def5678def5678def5678def5678def567',
            'branch refs/heads/locked-branch',
            'locked',
          ].join('\0'),
        ].join('\0\0') + '\0'

      const entries = parseWorktreePorcelainOutput(output)
      assert.strictEqual(entries[1].isLocked, true)
    })

    it('parses locked worktree with reason', () => {
      const output =
        [
          [
            'worktree /path/to/repo',
            'HEAD abc1234abc1234abc1234abc1234abc1234abc123',
            'branch refs/heads/main',
          ].join('\0'),
          [
            'worktree /path/to/locked-wt',
            'HEAD def5678def5678def5678def5678def5678def567',
            'branch refs/heads/locked-branch',
            'locked reason why it is locked',
          ].join('\0'),
        ].join('\0\0') + '\0'

      const entries = parseWorktreePorcelainOutput(output)
      assert.strictEqual(entries[1].isLocked, true)
    })

    it('parses prunable worktree', () => {
      const output =
        [
          [
            'worktree /path/to/repo',
            'HEAD abc1234abc1234abc1234abc1234abc1234abc123',
            'branch refs/heads/main',
          ].join('\0'),
          [
            'worktree /path/to/prunable-wt',
            'HEAD def5678def5678def5678def5678def5678def567',
            'branch refs/heads/stale',
            'prunable gitdir file points to non-existent location',
          ].join('\0'),
        ].join('\0\0') + '\0'

      const entries = parseWorktreePorcelainOutput(output)
      assert.strictEqual(entries[1].isPrunable, true)
    })

    it('parses paths with spaces', () => {
      const output =
        [
          [
            'worktree /path/to/my repo',
            'HEAD abc1234abc1234abc1234abc1234abc1234abc123',
            'branch refs/heads/main',
          ].join('\0'),
          [
            'worktree /path/to/my other worktree',
            'HEAD def5678def5678def5678def5678def5678def567',
            'branch refs/heads/feature',
          ].join('\0'),
        ].join('\0\0') + '\0'

      const entries = parseWorktreePorcelainOutput(output)
      assert.strictEqual(entries[0].path, Path.normalize('/path/to/my repo'))
      assert.strictEqual(
        entries[1].path,
        Path.normalize('/path/to/my other worktree')
      )
    })

    it('parses worktree with locked and prunable flags combined', () => {
      const output =
        [
          [
            'worktree /path/to/repo',
            'HEAD abc1234abc1234abc1234abc1234abc1234abc123',
            'branch refs/heads/main',
          ].join('\0'),
          [
            'worktree /path/to/bad-wt',
            'HEAD def5678def5678def5678def5678def5678def567',
            'detached',
            'locked',
            'prunable',
          ].join('\0'),
        ].join('\0\0') + '\0'

      const entries = parseWorktreePorcelainOutput(output)
      assert.strictEqual(entries[1].isDetached, true)
      assert.strictEqual(entries[1].isLocked, true)
      assert.strictEqual(entries[1].isPrunable, true)
      assert.strictEqual(entries[1].branch, null)
    })

    it('parses paths with newlines', () => {
      const output =
        [
          [
            'worktree /path/to/my\nrepo',
            'HEAD abc1234abc1234abc1234abc1234abc1234abc123',
            'branch refs/heads/main',
          ].join('\0'),
          [
            'worktree /path/to/my\nother\nworktree',
            'HEAD def5678def5678def5678def5678def5678def567',
            'branch refs/heads/feature',
          ].join('\0'),
        ].join('\0\0') + '\0'

      const entries = parseWorktreePorcelainOutput(output)
      assert.strictEqual(entries[0].path, Path.normalize('/path/to/my\nrepo'))
      assert.strictEqual(
        entries[1].path,
        Path.normalize('/path/to/my\nother\nworktree')
      )
    })
  })

  describe('listWorktrees', () => {
    /** Helper to extract checked-out branch refs from worktree entries */
    function checkedOutBranches(
      worktrees: ReadonlyArray<{ readonly branch: string | null }>
    ): ReadonlySet<string> {
      return new Set(worktrees.map(wt => wt.branch).filter(b => b !== null))
    }

    it('returns only main worktree branch when there are no linked worktrees', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })

      const branches = checkedOutBranches(await listWorktrees(repo))
      assert.strictEqual(branches.size, 1)
      assert(branches.has('refs/heads/main'))
    })

    it('returns branches checked out in linked worktrees', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      await exec(['branch', 'feature-a'], repo.path)
      await exec(
        ['worktree', 'add', repo.path + '-wt-a', 'feature-a'],
        repo.path
      )

      const branches = checkedOutBranches(await listWorktrees(repo))
      assert(branches.has('refs/heads/feature-a'))
      assert(branches.has('refs/heads/main'))
      assert.strictEqual(branches.size, 2)
    })

    it('handles multiple linked worktrees', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      await exec(['branch', 'feature-a'], repo.path)
      await exec(['branch', 'feature-b'], repo.path)
      await exec(
        ['worktree', 'add', repo.path + '-wt-a', 'feature-a'],
        repo.path
      )
      await exec(
        ['worktree', 'add', repo.path + '-wt-b', 'feature-b'],
        repo.path
      )

      const branches = checkedOutBranches(await listWorktrees(repo))
      assert(branches.has('refs/heads/feature-a'))
      assert(branches.has('refs/heads/feature-b'))
      assert(branches.has('refs/heads/main'))
      assert.strictEqual(branches.size, 3)
    })

    it('handles detached HEAD worktrees', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })

      const { stdout } = await exec(['rev-parse', 'HEAD'], repo.path)
      const sha = stdout.trim()
      await exec(
        ['worktree', 'add', '--detach', repo.path + '-wt-detached', sha],
        repo.path
      )

      const branches = checkedOutBranches(await listWorktrees(repo))
      assert.strictEqual(branches.size, 1)
      assert(branches.has('refs/heads/main'))
    })

    it('lists worktrees from a git dir after a linked worktree directory is removed', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      await exec(['branch', 'feature-a'], repo.path)

      const worktreePath = repo.path + '-wt-a'
      await exec(['worktree', 'add', worktreePath, 'feature-a'], repo.path)

      const { stdout } = await exec(['rev-parse', '--git-dir'], worktreePath)
      const gitDir = Path.resolve(worktreePath, stdout.trim())

      await rm(worktreePath, { recursive: true, force: true })

      const worktrees = await listWorktreesFromGitDir(gitDir)
      const mainWorktree = worktrees.find(wt => wt.type === 'main')
      const repoPath = await realpath(repo.path)
      const resolvedWorktreePath = repoPath + '-wt-a'

      assert.strictEqual(mainWorktree?.path, repoPath)
      assert(
        worktrees.some(wt => wt.path === resolvedWorktreePath && wt.isPrunable)
      )
    })
  })

  describe('parsePruneVerboseOutput', () => {
    it('returns empty array for empty output', () => {
      assert.deepStrictEqual(parsePruneVerboseOutput(''), [])
    })

    it('returns empty array for output with no entries', () => {
      assert.deepStrictEqual(parsePruneVerboseOutput('\n\n'), [])
    })

    it('parses a single Would-remove entry (dry-run)', () => {
      const output = "Would remove worktrees/wt-a: /path/to/wt-a\n"
      assert.deepStrictEqual(parsePruneVerboseOutput(output), ['/path/to/wt-a'])
    })

    it('parses a single Removing entry (live run)', () => {
      const output = "Removing worktrees/wt-a: /path/to/wt-a\n"
      assert.deepStrictEqual(parsePruneVerboseOutput(output), ['/path/to/wt-a'])
    })

    it('parses multiple entries', () => {
      const output =
        "Would remove worktrees/wt-a: /path/to/wt-a\n" +
        "Would remove worktrees/wt-b: /path/to/wt-b\n"
      assert.deepStrictEqual(parsePruneVerboseOutput(output), [
        '/path/to/wt-a',
        '/path/to/wt-b',
      ])
    })

    it('skips lines that do not look like prune entries', () => {
      const output =
        "Removing worktrees/wt-a: /path/to/wt-a\n" +
        "Some other diagnostic message\n"
      assert.deepStrictEqual(parsePruneVerboseOutput(output), ['/path/to/wt-a'])
    })

    it('skips lines whose tail is not an absolute path', () => {
      const output = "Removing worktrees/wt-a: relative/path\n"
      assert.deepStrictEqual(parsePruneVerboseOutput(output), [])
    })
  })

  describe('lockWorktree / unlockWorktree', () => {
    it('locks and unlocks a linked worktree', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      await exec(['branch', 'feature-a'], repo.path)
      const worktreePath = repo.path + '-wt-a'
      await addWorktree(repo, worktreePath, { commitish: 'feature-a' })

      // Before locking, the worktree is not locked.
      let wts = await listWorktrees(repo)
      assert.strictEqual(wts[1].isLocked, false)

      await lockWorktree(repo, worktreePath, 'fixing a bug')
      wts = await listWorktrees(repo)
      assert.strictEqual(wts[1].isLocked, true)

      await unlockWorktree(repo, worktreePath)
      wts = await listWorktrees(repo)
      assert.strictEqual(wts[1].isLocked, false)
    })

    it('locks without a reason', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      await exec(['branch', 'feature-a'], repo.path)
      const worktreePath = repo.path + '-wt-a'
      await addWorktree(repo, worktreePath, { commitish: 'feature-a' })

      await lockWorktree(repo, worktreePath)
      const wts = await listWorktrees(repo)
      assert.strictEqual(wts[1].isLocked, true)
    })
  })

  describe('pruneWorktrees', () => {
    it('dry-run returns paths that would be pruned, but does not remove them', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      await exec(['branch', 'feature-a'], repo.path)
      const worktreePath = repo.path + '-wt-a'
      await exec(['worktree', 'add', worktreePath, 'feature-a'], repo.path)

      // Make the worktree admin entry stale by removing its directory.
      await rm(worktreePath, { recursive: true, force: true })

      const wouldPrune = await pruneWorktrees(repo, true)
      assert.strictEqual(wouldPrune.length, 1)
      assert.strictEqual(wouldPrune[0], Path.resolve(worktreePath))

      // After dry-run, the admin entry still lists the worktree as prunable.
      const wts = await listWorktrees(repo)
      const resolvedPath = Path.resolve(worktreePath)
      assert(wts.some(wt => wt.path === resolvedPath))
    })

    it('live run removes stale admin entries', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      await exec(['branch', 'feature-a'], repo.path)
      const worktreePath = repo.path + '-wt-a'
      await exec(['worktree', 'add', worktreePath, 'feature-a'], repo.path)
      await rm(worktreePath, { recursive: true, force: true })

      const pruned = await pruneWorktrees(repo, false)
      assert.strictEqual(pruned.length, 1)

      const wts = await listWorktrees(repo)
      const resolvedPath = Path.resolve(worktreePath)
      assert(!wts.some(wt => wt.path === resolvedPath))
    })
  })

  describe('getWorktreeDirtyState', () => {
    it('returns zero counts for a clean worktree', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      const state = await getWorktreeDirtyState(repo.path)
      assert.deepStrictEqual(state, { modifiedCount: 0, untrackedCount: 0 })
    })

    it('counts modified tracked files', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      // Modify a tracked file AFTER the commit so it shows up as modified.
      const { writeFile } = await import('fs/promises')
      await writeFile(Path.join(repo.path, 'README'), 'changed')

      const state = await getWorktreeDirtyState(repo.path)
      assert.strictEqual(state.modifiedCount, 1)
      assert.strictEqual(state.untrackedCount, 0)
    })

    it('counts untracked files separately', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      // Modify a tracked file and add an untracked file AFTER the commit.
      const { writeFile } = await import('fs/promises')
      await writeFile(Path.join(repo.path, 'README'), 'changed')
      await writeFile(Path.join(repo.path, 'untracked.txt'), 'new')

      const state = await getWorktreeDirtyState(repo.path)
      assert.strictEqual(state.modifiedCount, 1)
      assert.strictEqual(state.untrackedCount, 1)
    })

    it('counts only untracked files when nothing is modified', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README', contents: 'hello' }],
      })
      const { writeFile } = await import('fs/promises')
      await writeFile(Path.join(repo.path, 'untracked.txt'), 'new')

      const state = await getWorktreeDirtyState(repo.path)
      assert.strictEqual(state.modifiedCount, 0)
      assert.strictEqual(state.untrackedCount, 1)
    })
  })
})
