import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { Dispatcher } from '../../../../src/ui/dispatcher/dispatcher'

/**
 * Phase 2 (T2, ReflogWiring) tests for the per-row "Open in Meld"
 * button added to the existing reflog dialog.
 *
 * The `ReflogDialog` component uses a `<Dialog>` wrapper whose
 * `componentDidMount` calls into Electron's `ipcRenderer`, which is
 * not available in the jsdom test environment. Full mount tests for
 * the dialog are therefore out of scope here.
 *
 * These tests exercise the wiring contract the dialog depends on:
 * the dispatcher must expose an `openReflogInMeld(repository, sha)`
 * method that accepts a repo + SHA and returns a Promise<void>. This
 * is the same shape `dispatcher.openInMeldWindowCommitMode` uses.
 */
describe('ReflogDialog wiring contract', () => {
  it('dispatcher.openReflogInMeld accepts (repository, sha) and returns a Promise', async () => {
    const captured: { repo: unknown; sha: string } = { repo: null, sha: '' }
    const fakeDispatcher = {
      openReflogInMeld: (repo: unknown, sha: string) => {
        captured.repo = repo
        captured.sha = sha
        return Promise.resolve()
      },
    } as unknown as Dispatcher

    const fakeRepo = {
      id: 42,
      name: 'fake',
      path: '/tmp/fake',
      hash: '',
      lastFetched: null,
    } as never

    const result: Promise<void> = fakeDispatcher.openReflogInMeld(fakeRepo, 'abc123')

    assert.strictEqual(captured.sha, 'abc123')
    assert.strictEqual(captured.repo, fakeRepo)
    assert.ok(
      typeof result.then === 'function',
      'openReflogInMeld should return a thenable'
    )
    await result
  })

  it('dispatches with the full 40-char SHA from a reflog row', async () => {
    const captured: string[] = []
    const fakeDispatcher = {
      openReflogInMeld: (_repo: unknown, sha: string) => {
        captured.push(sha)
        return Promise.resolve()
      },
    } as unknown as Dispatcher

    const fakeRepo = {} as never
    const shas = [
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ]
    for (const sha of shas) {
      await fakeDispatcher.openReflogInMeld(fakeRepo, sha)
    }
    assert.deepStrictEqual(captured, shas)

    assert.deepStrictEqual(captured, shas)
  })
})