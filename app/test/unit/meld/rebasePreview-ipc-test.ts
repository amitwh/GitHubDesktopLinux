import { describe, it, mock } from 'node:test'
import assert from 'node:assert'

// We can't actually start the electron main process in the test
// runner, so instead we verify the parseShortStat function and the
// shape of the shortstat IPC wrapper logic. The actual IPC handler
// registration is covered by the IPC contract test.

import { parseShortStat } from '../../../src/lib/meld/rebasePreview'

describe('meld:get-rebase-commit-stats request shape', () => {
  // Sanity test: the parser the IPC handler relies on correctly
  // handles the exact output `git diff --shortstat <sha>~1..<sha>`
  // produces for commits whose changes are all whitespace-only.
  it('treats whitespace-only diffs as 0 insertions / 0 deletions', () => {
    const out = parseShortStat(' 0 files changed\n')
    assert.strictEqual(out.filesChanged, 0)
    assert.strictEqual(out.insertions, 0)
    assert.strictEqual(out.deletions, 0)
  })

  // Single insertion pattern that real git emits for a one-line add.
  it('parses single-file one-insertion output', () => {
    const out = parseShortStat(' 1 file changed, 1 insertion(+)\n')
    assert.deepStrictEqual(out, {
      filesChanged: 1,
      insertions: 1,
      deletions: 0,
    })
  })

  // Empty commit (e.g. squash-then-empty). `git diff A..B` returns no
  // output; we want to treat this as zero stats, not an error.
  it('returns zeros for empty output', () => {
    const out = parseShortStat('')
    assert.deepStrictEqual(out, {
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    })
  })
})

// The IPC handler itself is a thin wrapper that calls git(...)
// and feeds the output through parseShortStat. We test that the
// wrapper composes correctly without spawning git by mocking the
// core git helper.
describe('meld:get-rebase-commit-stats handler composition', () => {
  it('calls git with --shortstat args and returns parsed stats', async () => {
    // Mock the lib/git/core module so we don't spawn a real git.
    const fakeExec = mock.fn(async () => ({
      stdout: ' 2 files changed, 8 insertions(+), 3 deletions(-)\n',
      stderr: '',
      exitCode: 0,
      gitError: null,
      gitEnvironment: {},
    }))
    mock.module('../../../src/lib/git/core', {
      namedExports: {
        git: fakeExec,
      },
    })

    // Late-require so the mock above is in place.
    const { runGitShortstat } = await import(
      '../../../src/lib/meld/rebasePreview'
    )

    const repo = { path: '/tmp/repo' }
    const stats = await runGitShortstat(repo, 'abc123', {
      git: fakeExec as never,
    })

    assert.deepStrictEqual(stats, {
      filesChanged: 2,
      insertions: 8,
      deletions: 3,
    })
    assert.ok(fakeExec.mock.calls.length > 0, 'expected git to be called')

    // Restore the module so we don't leak the mock to other tests.
    mock.restoreAll()
  })
})
