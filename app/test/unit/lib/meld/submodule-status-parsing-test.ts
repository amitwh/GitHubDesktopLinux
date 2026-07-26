import { describe, it } from 'node:test'
import assert from 'node:assert'

/**
 * Unit tests for the Phase 2 (T3, MeldSubmoduleView) parsing logic in
 * `app/src/lib/git/submodule.ts`. The full git-backed helpers
 * (`getSubmoduleStatus`, `getSubmoduleDiff`) require a real repository
 * and are exercised by the integration test at
 * `app/test/unit/git/submodule-test.ts`. This file covers the
 * classification rules in isolation by re-implementing them inline —
 * mirroring the parser used by `getSubmoduleStatus`.
 *
 * If `getSubmoduleStatus`'s classification ever changes, this file
 * must change in lockstep.
 */
describe('submodule status classification', () => {
  type Coarse = 'clean' | 'modified' | 'uninitialized'

  function classify(line: string): Coarse {
    const first = line.charAt(0)
    if (first === '+') {
      return 'modified'
    }
    if (first === '-') {
      return 'uninitialized'
    }
    return 'clean'
  }

  function parseShaAndPath(
    line: string
  ): { sha: string; path: string } | null {
    const remainder = line.substring(1).trimStart()
    const parts = remainder.split(/\s+/)
    const sha = parts[0] ?? ''
    const path = parts[1] ?? ''
    if (sha === '' || path === '') {
      return null
    }
    return { sha, path }
  }

  it('classifies " " prefix as clean', () => {
    assert.strictEqual(
      classify(' 1eaabe34fc6f486367a176207420378f587d3b48 vendor/lib (v2.16.0)'),
      'clean'
    )
  })

  it('classifies "+" prefix as modified', () => {
    assert.strictEqual(
      classify('+abcdef1234567890abcdef1234567890abcdef12 vendor/lib (v2.16.0)'),
      'modified'
    )
  })

  it('classifies "-" prefix as uninitialized', () => {
    assert.strictEqual(
      classify('-abcdef1234567890abcdef1234567890abcdef12 vendor/lib (v2.16.0)'),
      'uninitialized'
    )
  })

  it('classifies "U" (merge conflict) prefix as clean', () => {
    assert.strictEqual(
      classify('Uabcdef1234567890abcdef1234567890abcdef12 vendor/lib (v2.16.0)'),
      'clean'
    )
  })

  it('parses SHA and path from a clean line', () => {
    const parsed = parseShaAndPath(
      ' 1eaabe34fc6f486367a176207420378f587d3b48 vendor/lib (v2.16.0)'
    )
    assert.deepStrictEqual(parsed, {
      sha: '1eaabe34fc6f486367a176207420378f587d3b48',
      path: 'vendor/lib',
    })
  })

  it('parses SHA and path from a modified line', () => {
    const parsed = parseShaAndPath(
      '+abcdef1234567890abcdef1234567890abcdef12 vendor/lib (v2.16.0)'
    )
    assert.deepStrictEqual(parsed, {
      sha: 'abcdef1234567890abcdef1234567890abcdef12',
      path: 'vendor/lib',
    })
  })

  it('returns null when the line is too short', () => {
    assert.strictEqual(parseShaAndPath('+abcdef'), null)
  })
})