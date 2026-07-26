import { describe, it, mock } from 'node:test'
import assert from 'node:assert'

/**
 * Tests for the new worktree-related dispatcher wrappers in
 * `app/src/ui/dispatcher/dispatcher.ts`:
 *   - lockWorktree
 *   - unlockWorktree
 *   - pruneWorktrees
 *   - getWorktreeDirtyState
 *   - setAutoPruneWorktreesOnOpenSetting
 *
 * Each wrapper delegates to the corresponding `appStore._xxx` method.
 * We use a minimal Dispatcher-shaped object whose `appStore` field is
 * a mock — bypassing the constructor entirely so the test doesn't pull
 * in the full AppStore / StatsStore wiring.
 */
describe('Dispatcher worktree wrappers', () => {
  function makeAppStoreMock() {
    return {
      _lockWorktree: mock.fn(async () => undefined),
      _unlockWorktree: mock.fn(async () => undefined),
      _pruneWorktrees: mock.fn(async () => undefined),
      _getWorktreeDirtyState: mock.fn(async () => ({
        modifiedCount: 0,
        untrackedCount: 0,
      })),
      _setAutoPruneWorktreesOnOpenSetting: mock.fn(async () => undefined),
      postError: mock.fn(),
    }
  }

  function loadDispatcher() {
    return require('../../../src/ui/dispatcher/dispatcher').Dispatcher
  }

  function makeDispatcher(appStore: ReturnType<typeof makeAppStoreMock>) {
    const DispatcherCtor = loadDispatcher()
    // Bypass the constructor and wire the dependencies the wrapper
    // methods actually touch. The Dispatcher only references `appStore`
    // in the wrappers under test.
    const dispatcher = Object.create(DispatcherCtor.prototype)
    dispatcher.appStore = appStore
    return dispatcher
  }

  it('lockWorktree forwards to appStore._lockWorktree with reason', async () => {
    const appStore = makeAppStoreMock()
    const dispatcher = makeDispatcher(appStore)
    const repo = { id: 1, path: '/r' }
    const wtPath = '/r-wt'
    const reason = 'fixing'

    await dispatcher.lockWorktree(repo, wtPath, reason)

    assert.strictEqual(appStore._lockWorktree.mock.calls.length, 1)
    const call = appStore._lockWorktree.mock.calls[0] as unknown as {
      arguments: unknown[]
    }
    assert.strictEqual(call.arguments[0], repo)
    assert.strictEqual(call.arguments[1], wtPath)
    assert.strictEqual(call.arguments[2], reason)
  })

  it('lockWorktree forwards to appStore._lockWorktree without a reason', async () => {
    const appStore = makeAppStoreMock()
    const dispatcher = makeDispatcher(appStore)
    const repo = { id: 1, path: '/r' }

    await dispatcher.lockWorktree(repo, '/r-wt')

    assert.strictEqual(appStore._lockWorktree.mock.calls.length, 1)
    const call = appStore._lockWorktree.mock.calls[0] as unknown as {
      arguments: unknown[]
    }
    assert.strictEqual(call.arguments[2], undefined)
  })

  it('unlockWorktree forwards to appStore._unlockWorktree', async () => {
    const appStore = makeAppStoreMock()
    const dispatcher = makeDispatcher(appStore)
    const repo = { id: 1, path: '/r' }
    const wtPath = '/r-wt'

    await dispatcher.unlockWorktree(repo, wtPath)

    assert.strictEqual(appStore._unlockWorktree.mock.calls.length, 1)
    const call = appStore._unlockWorktree.mock.calls[0] as unknown as {
      arguments: unknown[]
    }
    assert.strictEqual(call.arguments[0], repo)
    assert.strictEqual(call.arguments[1], wtPath)
  })

  it('pruneWorktrees forwards to appStore._pruneWorktrees', async () => {
    const appStore = makeAppStoreMock()
    const dispatcher = makeDispatcher(appStore)
    const repo = { id: 1, path: '/r' }

    await dispatcher.pruneWorktrees(repo)

    assert.strictEqual(appStore._pruneWorktrees.mock.calls.length, 1)
    const call = appStore._pruneWorktrees.mock.calls[0] as unknown as {
      arguments: unknown[]
    }
    assert.strictEqual(call.arguments[0], repo)
  })

  it('getWorktreeDirtyState forwards and returns the result', async () => {
    const appStore = makeAppStoreMock()
    appStore._getWorktreeDirtyState.mock.mockImplementation(async () => ({
      modifiedCount: 2,
      untrackedCount: 3,
    }))
    const dispatcher = makeDispatcher(appStore)

    const result = await dispatcher.getWorktreeDirtyState('/some/path')

    assert.deepStrictEqual(result, { modifiedCount: 2, untrackedCount: 3 })
    assert.strictEqual(
      appStore._getWorktreeDirtyState.mock.calls.length,
      1
    )
    const call = appStore._getWorktreeDirtyState.mock.calls[0] as unknown as {
      arguments: unknown[]
    }
    assert.strictEqual(call.arguments[0], '/some/path')
  })

  it('setAutoPruneWorktreesOnOpenSetting forwards to appStore', async () => {
    const appStore = makeAppStoreMock()
    const dispatcher = makeDispatcher(appStore)

    await dispatcher.setAutoPruneWorktreesOnOpenSetting(true)

    assert.strictEqual(
      appStore._setAutoPruneWorktreesOnOpenSetting.mock.calls.length,
      1
    )
    const call = appStore._setAutoPruneWorktreesOnOpenSetting.mock
      .calls[0] as unknown as { arguments: unknown[] }
    assert.strictEqual(call.arguments[0], true)
  })
})