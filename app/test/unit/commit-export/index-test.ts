import assert from 'node:assert'
import { afterEach, describe, it, mock } from 'node:test'

import { Commit } from '../../../src/models/commit'
import { CommitIdentity } from '../../../src/models/commit-identity'
import { Repository } from '../../../src/models/repository'

/**
 * Captured `getCommits` invocations. Each test sets the response to a
 * specific value before exercising the API.
 */
const getCommitsCalls: Array<{
  readonly repositoryId: number
  readonly branch: string | undefined
}> = []

let getCommitsResult: ReadonlyArray<Commit> = []
let getCommitsError: Error | null = null

mock.module('../../../src/lib/git/log', {
  namedExports: {
    getCommits: async (
      repository: Repository,
      branch: string | undefined
    ): Promise<ReadonlyArray<Commit>> => {
      getCommitsCalls.push({ repositoryId: repository.id, branch })
      if (getCommitsError !== null) {
        throw getCommitsError
      }
      return getCommitsResult
    },
  },
})

/**
 * Track `convertWithPandoc` invocations so the test can verify the
 * happy-path flow invokes pandoc for non-markdown formats.
 */
const convertCalls: Array<{
  readonly content: string
  readonly outputPath: string
  readonly format: string
}> = []

mock.module('../../../src/lib/commit-export/pandoc-converter', {
  namedExports: {
    convertWithPandoc: async (
      content: string,
      outputPath: string,
      format: string
    ): Promise<void> => {
      convertCalls.push({ content, outputPath, format })
    },
    getFormatFromExtension: (ext: string) => {
      if (ext === '.pdf') return 'pdf'
      if (ext === '.docx') return 'docx'
      return undefined
    },
  },
})

/**
 * Captured `fs.writeFile` calls. We mock `fs/promises` rather than mutate
 * it (its named exports are read-only).
 */
const writeFileCalls: Array<{ readonly path: string; readonly content: string }> = []

let writeFileError: Error | null = null

mock.module('fs/promises', {
  namedExports: {
    writeFile: async (path: string, content: string) => {
      writeFileCalls.push({ path, content })
      if (writeFileError !== null) {
        throw writeFileError
      }
    },
  },
})

// Also mock the `fs` namespace import (`import { promises as fs } from 'fs'`)
// used by `commit-export/index.ts`. Node exposes `fs.promises` as the same
// module object, so duplicating the mock keeps both reference paths working.
mock.module('fs', {
  namedExports: {
    promises: {
      writeFile: async (path: string, content: string) => {
        writeFileCalls.push({ path, content })
        if (writeFileError !== null) {
          throw writeFileError
        }
      },
    },
  },
})

afterEach(() => {
  getCommitsCalls.length = 0
  convertCalls.length = 0
  writeFileCalls.length = 0
  getCommitsResult = []
  getCommitsError = null
  writeFileError = null
})

function makeCommit(summary: string): Commit {
  const date = new Date('2026-01-15T10:30:00.000Z')
  const identity = new CommitIdentity('Mona Lisa', 'mona@example.com', date)
  return new Commit(
    'a'.repeat(40),
    'a'.repeat(7),
    summary,
    '',
    identity,
    identity,
    [],
    [],
    []
  )
}

function makeRepository(name = 'demo-repo', id = 1): Repository {
  return new Repository(`/tmp/${name}`, id, null, false)
}

describe('commit-export/index', () => {
  describe('exportCommitHistory', () => {
    it('passes the repository and the requested branch to getCommits', async () => {
      getCommitsResult = [makeCommit('first')]

      const { exportCommitHistory } = await import(
        '../../../src/lib/commit-export'
      )

      const repo = makeRepository('demo-repo', 42)
      await exportCommitHistory(repo, {
        format: 'markdown',
        outputPath: '/tmp/demo-repo.md',
        includeHash: true,
        includeAuthor: true,
        includeDate: true,
        includeMessage: true,
        includeStats: true,
        branch: 'feat/linux-port',
      })

      assert.strictEqual(getCommitsCalls.length, 1)
      assert.strictEqual(getCommitsCalls[0].repositoryId, 42)
      assert.strictEqual(getCommitsCalls[0].branch, 'feat/linux-port')
    })

    it('writes a Markdown file directly when format is "markdown"', async () => {
      getCommitsResult = [
        makeCommit('first commit'),
        makeCommit('second commit'),
      ]

      const { exportCommitHistory } = await import(
        '../../../src/lib/commit-export'
      )

      await exportCommitHistory(makeRepository('demo-repo'), {
        format: 'markdown',
        outputPath: '/tmp/demo-repo.md',
        includeHash: true,
        includeAuthor: true,
        includeDate: true,
        includeMessage: true,
        includeStats: true,
      })

      assert.strictEqual(writeFileCalls.length, 1)
      assert.strictEqual(writeFileCalls[0].path, '/tmp/demo-repo.md')
      assert.ok(writeFileCalls[0].content.includes('demo-repo'))
      assert.ok(writeFileCalls[0].content.includes('first commit'))
      assert.ok(writeFileCalls[0].content.includes('second commit'))
      // Markdown format does not invoke the pandoc binary at all.
      assert.strictEqual(convertCalls.length, 0)
    })

    it('invokes convertWithPandoc (and not fs.writeFile) for non-markdown formats', async () => {
      getCommitsResult = [makeCommit('only commit')]

      const { exportCommitHistory } = await import(
        '../../../src/lib/commit-export'
      )

      await exportCommitHistory(makeRepository('demo-repo'), {
        format: 'pdf',
        outputPath: '/tmp/demo-repo.pdf',
        includeHash: true,
        includeAuthor: true,
        includeDate: true,
        includeMessage: true,
        includeStats: true,
      })

      assert.strictEqual(convertCalls.length, 1)
      assert.strictEqual(convertCalls[0].format, 'pdf')
      assert.strictEqual(convertCalls[0].outputPath, '/tmp/demo-repo.pdf')
      assert.ok(convertCalls[0].content.includes('only commit'))
      assert.strictEqual(writeFileCalls.length, 0)
    })

    it('propagates errors from getCommits', async () => {
      getCommitsError = new Error('fatal: not a git repository')

      const { exportCommitHistory } = await import(
        '../../../src/lib/commit-export'
      )

      await assert.rejects(
        () =>
          exportCommitHistory(makeRepository('demo-repo'), {
            format: 'markdown',
            outputPath: '/tmp/demo-repo.md',
            includeHash: true,
            includeAuthor: true,
            includeDate: true,
            includeMessage: true,
            includeStats: true,
          }),
        /fatal: not a git repository/
      )
    })

    it('rejects when the repository is missing and getCommits fails', async () => {
      // Repository with `missing: true` — getCommits still gets called
      // because the public API doesn't pre-check the missing flag (it
      // delegates to getCommits, which then surfaces an error from git).
      getCommitsError = new Error('repository missing on disk')

      const { exportCommitHistory } = await import(
        '../../../src/lib/commit-export'
      )

      const repo = new Repository('/tmp/gone', 99, null, true)
      await assert.rejects(
        () =>
          exportCommitHistory(repo, {
            format: 'markdown',
            outputPath: '/tmp/gone.md',
            includeHash: true,
            includeAuthor: true,
            includeDate: true,
            includeMessage: true,
            includeStats: true,
          }),
        /repository missing on disk/
      )
    })

    it('writes an empty Markdown file (only the header) when there are no commits', async () => {
      getCommitsResult = []

      const { exportCommitHistory } = await import(
        '../../../src/lib/commit-export'
      )

      await exportCommitHistory(makeRepository('demo-repo'), {
        format: 'markdown',
        outputPath: '/tmp/demo-repo.md',
        includeHash: true,
        includeAuthor: true,
        includeDate: true,
        includeMessage: true,
        includeStats: true,
      })

      assert.strictEqual(writeFileCalls.length, 1)
      assert.ok(writeFileCalls[0].content.includes('Total commits: 0'))
    })
  })
})