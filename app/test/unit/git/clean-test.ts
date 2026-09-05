import { describe, it } from 'node:test'
import assert from 'node:assert'
import { exec } from 'dugite'
import { mkdir, writeFile } from 'fs/promises'
import * as path from 'path'

import { Repository } from '../../../src/models/repository'
import { cleanUntrackedFiles } from '../../../src/lib/git/clean'
import { setupEmptyRepository } from '../../helpers/repositories'
import { makeCommit } from '../../helpers/repository-scaffolding'

describe('git/clean', () => {
  describe('cleanUntrackedFiles', () => {
    it('removes a single untracked file', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'init' }],
      })

      const untracked = path.join(repo.path, 'scratch.txt')
      await writeFile(untracked, 'temp')

      await cleanUntrackedFiles(repo)

      // git status should now be clean.
      const status = await exec(['status', '--porcelain'], repo.path)
      assert.strictEqual(status.stdout.trim(), '')
    })

    it('removes untracked directories and their contents', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'init' }],
      })

      const dir = path.join(repo.path, 'tmp')
      await mkdir(dir, { recursive: true })
      await writeFile(path.join(dir, 'inner.txt'), 'inner content')
      await writeFile(path.join(dir, 'another.txt'), 'more')

      await cleanUntrackedFiles(repo)

      const status = await exec(['status', '--porcelain'], repo.path)
      assert.strictEqual(status.stdout.trim(), '')
    })

    it('does not remove tracked files', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'tracked' }],
      })

      // Add an untracked file too, to make sure clean doesn't get confused.
      await writeFile(path.join(repo.path, 'extra.txt'), 'extra')

      await cleanUntrackedFiles(repo)

      // README.md must still be tracked.
      const ls = await exec(['ls-files'], repo.path)
      assert.ok(
        ls.stdout.includes('README.md'),
        'expected README.md to remain tracked after clean'
      )

      const status = await exec(['status', '--porcelain'], repo.path)
      assert.strictEqual(status.stdout.trim(), '')
    })

    it('is a no-op when there are no untracked files', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'init' }],
      })

      await cleanUntrackedFiles(repo)

      const status = await exec(['status', '--porcelain'], repo.path)
      assert.strictEqual(status.stdout.trim(), '')
    })

    it('rejects empty repository paths without throwing', async t => {
      const repo = new Repository('/nonexistent/path', -1, null, false)
      await assert.rejects(async () => cleanUntrackedFiles(repo))
    })
  })
})
