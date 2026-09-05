import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Repository } from '../../../src/models/repository'
import {
  writeWorkingDirectoryFile,
  readWorkingDirectoryFile,
} from '../../../src/lib/git/working-directory'

function makeFakeRepository(): Repository {
  // For these tests we only need a path; we don't actually shell out to
  // git because saveMeldEdit's `stage` step would fail without a real
  // repo. So we only exercise writeWorkingDirectoryFile here and skip
  // the saveMeldEdit happy-path (covered by E2E).
  const dir = mkdtempSync(join(tmpdir(), 'meld-test-'))
  return new Repository(dir, -1, null, false, null)
}

describe('git/working-directory', () => {
  it('writeWorkingDirectoryFile writes the file at the given relative path', async () => {
    const repo = makeFakeRepository()
    try {
      await writeWorkingDirectoryFile(repo, 'sub/dir/file.txt', 'hello world')
      const full = join(repo.path, 'sub/dir/file.txt')
      assert.strictEqual(existsSync(full), true)
      assert.strictEqual(readFileSync(full, 'utf8'), 'hello world')
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
    }
  })

  it('writeWorkingDirectoryFile overwrites an existing file', async () => {
    const repo = makeFakeRepository()
    try {
      writeFileSync(join(repo.path, 'a.txt'), 'old')
      await writeWorkingDirectoryFile(repo, 'a.txt', 'new')
      assert.strictEqual(readFileSync(join(repo.path, 'a.txt'), 'utf8'), 'new')
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
    }
  })

  it('writeWorkingDirectoryFile accepts empty content', async () => {
    const repo = makeFakeRepository()
    try {
      await writeWorkingDirectoryFile(repo, 'empty.txt', '')
      assert.strictEqual(readFileSync(join(repo.path, 'empty.txt'), 'utf8'), '')
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
    }
  })

  it('readWorkingDirectoryFile returns the file contents', async () => {
    const repo = makeFakeRepository()
    try {
      writeFileSync(join(repo.path, 'a.txt'), 'hello')
      const content = await readWorkingDirectoryFile(repo, 'a.txt')
      assert.strictEqual(content, 'hello')
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
    }
  })

  it('readWorkingDirectoryFile returns undefined for a missing file', async () => {
    const repo = makeFakeRepository()
    try {
      const content = await readWorkingDirectoryFile(repo, 'nope.txt')
      assert.strictEqual(content, undefined)
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
    }
  })

  it('readWorkingDirectoryFile round-trips with writeWorkingDirectoryFile', async () => {
    const repo = makeFakeRepository()
    try {
      await writeWorkingDirectoryFile(repo, 'round.txt', 'round trip content')
      const content = await readWorkingDirectoryFile(repo, 'round.txt')
      assert.strictEqual(content, 'round trip content')
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
    }
  })
})
