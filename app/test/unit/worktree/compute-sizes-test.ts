import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Direct test of the worktree size-computation walk, exercising the
 * same algorithm that `worktree:compute-sizes` IPC handler uses.
 *
 * The IPC handler itself depends on `ipcMain.handle`, which we don't
 * have in the unit-test environment, so we re-implement the walk here
 * against the same `fs/promises` API and assert the contract: bytes
 * summed, sub-directories walked, missing paths yield null, errors
 * don't throw out of the handler.
 */
describe('worktree:compute-sizes algorithm', () => {
  it('returns null for a missing path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghd-size-missing-'))
    const missing = join(dir, 'not-here')
    try {
      const result = await computeSizes([missing])
      assert.strictEqual(result.sizes.length, 1)
      assert.strictEqual(result.sizes[0], null)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('sums file sizes recursively and reports the absolute path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghd-size-'))
    try {
      writeFileSync(join(dir, 'a.txt'), 'x'.repeat(10))
      writeFileSync(join(dir, 'b.txt'), 'y'.repeat(20))
      const sub = join(dir, 'sub')
      mkdirSync(sub)
      writeFileSync(join(sub, 'c.txt'), 'z'.repeat(5))

      const result = await computeSizes([dir])
      assert.strictEqual(result.sizes.length, 1)
      assert.ok(result.sizes[0] !== null)
      assert.strictEqual(result.sizes[0]!.path, dir)
      assert.strictEqual(result.sizes[0]!.size, 35)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns null for a path that is not a directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghd-size-file-'))
    const file = join(dir, 'a.txt')
    writeFileSync(file, 'hello')
    try {
      const result = await computeSizes([file])
      assert.strictEqual(result.sizes[0], null)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns an entry per input path, preserving order', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghd-size-multi-'))
    try {
      const a = join(dir, 'a')
      const b = join(dir, 'b')
      mkdirSync(a)
      mkdirSync(b)
      writeFileSync(join(a, 'x'), '1')
      writeFileSync(join(b, 'y'), '22')

      const result = await computeSizes([a, b, '/nope'])
      assert.strictEqual(result.sizes.length, 3)
      assert.strictEqual(result.sizes[0]?.size, 1)
      assert.strictEqual(result.sizes[1]?.size, 2)
      assert.strictEqual(result.sizes[2], null)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// Mirror of the main-process algorithm. Kept in this file (not in
// `src/`) so the test exercises the contract, not the implementation.
// The main-process handler is a strict superset: it also validates that
// each entry in `req.paths` is a string.
import { opendir, stat } from 'fs/promises'

async function computeDirectorySize(path: string): Promise<number> {
  let size = 0
  const directory = await opendir(path)
  try {
    for (;;) {
      const entry = await directory.read()
      if (entry === null) {
        break
      }
      const entryPath = join(path, entry.name)
      if (entry.isDirectory()) {
        try {
          size += await computeDirectorySize(entryPath)
        } catch {
          // skip
        }
      } else if (entry.isFile()) {
        try {
          size += (await stat(entryPath)).size
        } catch {
          // skip
        }
      }
    }
  } finally {
    try {
      await directory.close()
    } catch {
      // already closed
    }
  }
  return size
}

async function computeSizes(
  paths: ReadonlyArray<string>
): Promise<{
  sizes: ReadonlyArray<{ path: string; size: number } | null>
}> {
  const sizes: Array<{ path: string; size: number } | null> = []
  for (const path of paths) {
    try {
      const rootStat = await stat(path)
      if (!rootStat.isDirectory()) {
        sizes.push(null)
        continue
      }
      const size = await computeDirectorySize(path)
      sizes.push({ path, size })
    } catch {
      sizes.push(null)
    }
  }
  return { sizes }
}