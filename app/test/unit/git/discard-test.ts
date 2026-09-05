import { describe, it } from 'node:test'
import assert from 'node:assert'
import { exec } from 'dugite'
import { mkdir, writeFile } from 'fs/promises'
import * as path from 'path'

import { Repository } from '../../../src/models/repository'
import { discardAllChanges } from '../../../src/lib/git/discard'
import { setupEmptyRepository } from '../../helpers/repositories'
import { makeCommit } from '../../helpers/repository-scaffolding'

describe('git/discard', () => {
  describe('discardAllChanges', () => {
    it('reverts tracked file modifications in the working tree', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'initial content\n' }],
      })

      // Modify the tracked file in the working tree.
      await writeFile(path.join(repo.path, 'README.md'), 'modified content\n')

      // Verify there is a modified file before discarding.
      const before = await exec(['status', '--porcelain'], repo.path)
      assert.ok(
        before.stdout.includes('README.md'),
        'expected README.md to be reported as modified before discard'
      )

      await discardAllChanges(repo)

      // After discard, status should report a clean working tree.
      const after = await exec(['status', '--porcelain'], repo.path)
      assert.strictEqual(after.stdout.trim(), '')

      // File contents should match the committed version.
      const { stdout } = await exec(['show', 'HEAD:README.md'], repo.path)
      assert.strictEqual(stdout, 'initial content\n')
    })

    it('discards modifications across multiple tracked files', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      // Make sure the nested directory exists so writeFile can create
      // files inside it. makeCommit only writes the leaf file but
      // doesn't auto-create intermediate directories.
      await mkdir(path.join(repo.path, 'src'), { recursive: true })
      await makeCommit(repo, {
        entries: [
          { path: 'README.md', contents: 'a' },
          { path: 'src/index.ts', contents: 'b' },
        ],
      })

      await writeFile(path.join(repo.path, 'README.md'), 'A')
      await writeFile(path.join(repo.path, 'src/index.ts'), 'B')

      await discardAllChanges(repo)

      const status = await exec(['status', '--porcelain'], repo.path)
      assert.strictEqual(status.stdout.trim(), '')
    })

    it('does not remove untracked files', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'init' }],
      })

      const untrackedPath = path.join(repo.path, 'untracked.txt')
      await writeFile(untrackedPath, 'not tracked')

      await discardAllChanges(repo)

      // The untracked file must still exist after discard.
      const status = await exec(['status', '--porcelain'], repo.path)
      assert.ok(
        status.stdout.includes('untracked.txt'),
        'expected untracked.txt to remain after discard'
      )
    })

    it('handles a repository with no working-tree changes as a no-op', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'clean' }],
      })

      // Should not throw when there is nothing to discard.
      await discardAllChanges(repo)

      const status = await exec(['status', '--porcelain'], repo.path)
      assert.strictEqual(status.stdout.trim(), '')
    })

    it('rejects empty repository paths without throwing', async t => {
      // Verifies the wrapper executes the git command and surfaces any
      // underlying error rather than swallowing it silently.
      const repo = new Repository('/nonexistent/path', -1, null, false)
      await assert.rejects(async () => discardAllChanges(repo))
    })
  })
})
