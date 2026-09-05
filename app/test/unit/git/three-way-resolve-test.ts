import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Repository } from '../../../src/models/repository'
import { readThreeWayContents } from '../../../src/lib/git/three-way-resolve'

function makeRealGitRepository(): Repository {
  const dir = mkdtempSync(join(tmpdir(), 'twr-test-'))
  // Init a bare git repo so we can commit
  const { execSync } = require('child_process')
  execSync('git init', { cwd: dir })
  execSync('git config user.email "test@example.com"', { cwd: dir })
  execSync('git config user.name "Test"', { cwd: dir })
  return new Repository(dir, -1, null, false, null)
}

describe('git/three-way-resolve', () => {
  let repo: Repository

  beforeEach(() => {
    repo = makeRealGitRepository()
  })

  afterEach(() => {
    rmSync(repo.path, { recursive: true, force: true })
  })

  it('reads BASE via git show <base>:<path> and decodes as utf8', async () => {
    // Set up: commit file "readme.md" with content "base content\n"
    writeFileSync(join(repo.path, 'readme.md'), 'base content\n')
    const { execSync } = require('child_process')
    execSync('git add readme.md', { cwd: repo.path })
    execSync('git commit -m "initial"', { cwd: repo.path })
    const sha = execSync('git rev-parse HEAD', { cwd: repo.path })
      .toString()
      .trim()

    const result = await readThreeWayContents(repo, 'readme.md', sha, sha)
    assert.strictEqual(result.baseContent, 'base content\n')
  })

  it('reads LOCAL from the working tree', async () => {
    writeFileSync(join(repo.path, 'localfile.txt'), 'local version\n')
    const { execSync } = require('child_process')
    execSync('git add localfile.txt', { cwd: repo.path })
    execSync('git commit -m "init"', { cwd: repo.path })

    // Modify the working tree file without committing
    writeFileSync(join(repo.path, 'localfile.txt'), 'local version modified\n')

    const result = await readThreeWayContents(
      repo,
      'localfile.txt',
      'HEAD',
      'HEAD'
    )
    assert.strictEqual(result.localContent, 'local version modified\n')
  })

  it('reads REMOTE via git show <theirs>:<path> and decodes as utf8', async () => {
    writeFileSync(join(repo.path, 'remotefile.txt'), 'remote version\n')
    const { execSync } = require('child_process')
    execSync('git add remotefile.txt', { cwd: repo.path })
    execSync('git commit -m "init remote"', { cwd: repo.path })
    const sha = execSync('git rev-parse HEAD', { cwd: repo.path })
      .toString()
      .trim()

    const result = await readThreeWayContents(repo, 'remotefile.txt', sha, sha)
    assert.strictEqual(result.remoteContent, 'remote version\n')
  })

  it('returns empty string for BASE when file was added in only one branch', async () => {
    const { execSync } = require('child_process')

    // Commit 1: a file that exists in the base
    writeFileSync(join(repo.path, 'initial.txt'), 'initial content\n')
    execSync('git add initial.txt', { cwd: repo.path })
    execSync('git commit -m "initial commit"', { cwd: repo.path })

    // Commit 2: add newfile.txt (no newfile.txt in commit 1)
    writeFileSync(join(repo.path, 'newfile.txt'), 'only in this branch\n')
    execSync('git add newfile.txt', { cwd: repo.path })
    execSync('git commit -m "add newfile"', { cwd: repo.path })
    const commitSha = execSync('git rev-parse HEAD', { cwd: repo.path })
      .toString()
      .trim()

    // Parent commit (no newfile.txt) as merge base
    const parentSha = execSync('git rev-parse HEAD~1', { cwd: repo.path })
      .toString()
      .trim()

    const result = await readThreeWayContents(
      repo,
      'newfile.txt',
      parentSha,
      commitSha
    )
    // The file doesn't exist in the parent — BASE must be empty string, not undefined
    assert.strictEqual(result.baseContent, '')
  })
})
