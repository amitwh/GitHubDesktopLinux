import { describe, it } from 'node:test'
import assert from 'node:assert'
import { exec } from 'dugite'

import { getPreviousCommitSha } from '../../../src/lib/git/compare'
import { Repository } from '../../../src/models/repository'
import { setupEmptyRepository } from '../../helpers/repositories'
import { makeCommit } from '../../helpers/repository-scaffolding'

describe('git/compare', () => {
  describe('getPreviousCommitSha', () => {
    it('returns the parent SHA when HEAD has a parent', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'first' }],
        commitMessage: 'first commit',
      })
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'second' }],
        commitMessage: 'second commit',
      })

      const previous = await getPreviousCommitSha(repo)
      assert.ok(previous !== null, 'expected HEAD~1 SHA to be resolved')
      assert.strictEqual(previous!.length, 40, 'expected a full 40-char SHA')

      // HEAD~1 must point at the first commit.
      const { stdout } = await exec(['rev-parse', 'HEAD~1'], repo.path)
      assert.strictEqual(stdout.trim(), previous)
    })

    it('returns null when HEAD is the initial commit', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'only' }],
        commitMessage: 'initial commit',
      })

      const previous = await getPreviousCommitSha(repo)
      assert.strictEqual(previous, null)
    })

    it('returns null for an unborn repository with no commits', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      const previous = await getPreviousCommitSha(repo)
      assert.strictEqual(previous, null)
    })

    it('rejects empty repository paths without throwing', async t => {
      const repo = new Repository('/nonexistent/path', -1, null, false)
      await assert.rejects(async () => getPreviousCommitSha(repo))
    })

    it('returns a SHA that is a valid git object', async t => {
      const repo = await setupEmptyRepository(t, 'main')
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'a' }],
      })
      await makeCommit(repo, {
        entries: [{ path: 'README.md', contents: 'b' }],
      })

      const previous = await getPreviousCommitSha(repo)
      assert.ok(previous !== null)

      // cat-file -t should print "commit" for a valid commit SHA.
      const { stdout } = await exec(['cat-file', '-t', previous!], repo.path)
      assert.strictEqual(stdout.trim(), 'commit')
    })
  })
})
