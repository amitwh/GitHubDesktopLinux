import { describe, it } from 'node:test'
import assert from 'node:assert'
import { MeldSessionPersistence } from '../../../src/lib/meld/sessionPersistence'
import { IMeldEditState } from '../../../src/models/meld-edit'

describe('meld/sessionPersistence', () => {
  it('returns undefined for an unknown key', () => {
    const cache = new MeldSessionPersistence()
    assert.strictEqual(cache.getEditState('nope'), undefined)
  })

  it('stores and retrieves edit state by key', () => {
    const cache = new MeldSessionPersistence()
    const state: IMeldEditState = {
      leftContent: 'a',
      rightContent: 'b',
      leftOriginal: 'a',
      rightOriginal: 'b',
      hasChanges: false,
    }
    cache.setEditState('repo:file:working', state)
    assert.strictEqual(cache.getEditState('repo:file:working'), state)
  })

  it('overwrites an existing entry when setEditState is called twice', () => {
    const cache = new MeldSessionPersistence()
    const a: IMeldEditState = {
      leftContent: 'a',
      rightContent: 'b',
      leftOriginal: 'a',
      rightOriginal: 'b',
      hasChanges: false,
    }
    const b: IMeldEditState = { ...a, hasChanges: true }
    cache.setEditState('k', a)
    cache.setEditState('k', b)
    assert.strictEqual(cache.getEditState('k'), b)
  })

  it('clears an entry', () => {
    const cache = new MeldSessionPersistence()
    const state: IMeldEditState = {
      leftContent: 'a',
      rightContent: 'b',
      leftOriginal: 'a',
      rightOriginal: 'b',
      hasChanges: false,
    }
    cache.setEditState('k', state)
    cache.clearEditState('k')
    assert.strictEqual(cache.getEditState('k'), undefined)
  })

  it('computes the same key for the same (repo, file, mode) tuple', () => {
    const k1 = MeldSessionPersistence.keyFor(1, 'src/a.ts', 'working')
    const k2 = MeldSessionPersistence.keyFor(1, 'src/a.ts', 'working')
    assert.strictEqual(k1, k2)
  })

  it('produces different keys for different modes on the same file', () => {
    const k1 = MeldSessionPersistence.keyFor(1, 'src/a.ts', 'working')
    const k2 = MeldSessionPersistence.keyFor(1, 'src/a.ts', 'commit')
    assert.notStrictEqual(k1, k2)
  })

  it('isolates two instances from each other', () => {
    const a = new MeldSessionPersistence()
    const b = new MeldSessionPersistence()
    a.setEditState('k', {
      leftContent: 'x',
      rightContent: 'y',
      leftOriginal: 'x',
      rightOriginal: 'y',
      hasChanges: false,
    })
    assert.strictEqual(b.getEditState('k'), undefined)
  })
})
