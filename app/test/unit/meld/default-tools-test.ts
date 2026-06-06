import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getDefaultExternalTools } from '../../../src/lib/meld/default-tools'

describe('default-tools/getDefaultExternalTools', () => {
  it('returns exactly 5 default tools', () => {
    assert.strictEqual(getDefaultExternalTools().length, 5)
  })

  it('includes Meld with %L %R args', () => {
    const meld = getDefaultExternalTools().find(t => t.name === 'Meld')
    assert.ok(meld !== undefined, 'Meld should be in the default tools list')
    assert.strictEqual(meld!.command, 'meld')
    assert.strictEqual(meld!.args, '%L %R')
    assert.strictEqual(meld!.builtIn, true)
  })

  it('includes KDiff3 with %L %R args', () => {
    const kdiff3 = getDefaultExternalTools().find(t => t.name === 'KDiff3')
    assert.ok(kdiff3 !== undefined)
    assert.strictEqual(kdiff3!.args, '%L %R')
  })

  it('includes VS Code with --diff %L %R args', () => {
    const code = getDefaultExternalTools().find(t => t.name === 'VS Code')
    assert.ok(code !== undefined)
    assert.strictEqual(code!.args, '--diff %L %R')
  })

  it('marks all default tools as builtIn', () => {
    for (const tool of getDefaultExternalTools()) {
      assert.strictEqual(tool.builtIn, true, `${tool.name} should be builtIn`)
    }
  })

  it('gives each tool a unique id', () => {
    const ids = getDefaultExternalTools().map(t => t.id)
    const unique = new Set(ids)
    assert.strictEqual(unique.size, ids.length)
  })
})
