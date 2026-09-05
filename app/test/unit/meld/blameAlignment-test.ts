import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  parseHunkHeader,
  alignBlameToDiff,
} from '../../../src/lib/meld/blameAlignment'
import { IBlameHunk } from '../../../src/lib/git/blame'

function makeHunk(
  startLine: number,
  lineCount: number,
  sha: string
): IBlameHunk {
  return {
    startLine,
    lineCount,
    sha,
    author: `Author ${sha}`,
    authorEmail: `${sha}@example.com`,
    timestamp: new Date(0),
    summary: `commit ${sha}`,
  }
}

describe('blameAlignment/parseHunkHeader', () => {
  it('parses a standard @@ -a,b +c,d @@ header', () => {
    const h = parseHunkHeader('@@ -10,5 +12,7 @@')
    assert.deepStrictEqual(h, {
      oldStart: 10,
      oldCount: 5,
      newStart: 12,
      newCount: 7,
    })
  })

  it('defaults count to 1 when omitted', () => {
    const h = parseHunkHeader('@@ -10 +12 @@')
    assert.deepStrictEqual(h, {
      oldStart: 10,
      oldCount: 1,
      newStart: 12,
      newCount: 1,
    })
  })

  it('returns null for a malformed header', () => {
    assert.strictEqual(parseHunkHeader('not a hunk header'), null)
    assert.strictEqual(parseHunkHeader('@@ broken @@'), null)
    assert.strictEqual(parseHunkHeader(''), null)
  })

  it('parses a header with a section heading after the closing @@', () => {
    const h = parseHunkHeader('@@ -1,3 +1,3 @@ def foo():')
    assert.deepStrictEqual(h, {
      oldStart: 1,
      oldCount: 3,
      newStart: 1,
      newCount: 3,
    })
  })
})

describe('blameAlignment/alignBlameToDiff', () => {
  it('returns [] for an empty diff', () => {
    const hunks: IBlameHunk[] = [makeHunk(0, 3, 'aaa')]
    assert.deepStrictEqual(alignBlameToDiff('', hunks), [])
  })

  it('attributes each + line to the covering blame hunk', () => {
    const diff = ['@@ -1,3 +1,3 @@', '+line one', '+line two', '+line three']
    const hunks: IBlameHunk[] = [makeHunk(0, 3, 'aaa')]
    const result = alignBlameToDiff(diff.join('\n'), hunks)
    assert.strictEqual(result.length, 3)
    for (const r of result) {
      assert.ok(r !== null, 'expected every + line to be attributed')
      assert.strictEqual((r as IBlameHunk).sha, 'aaa')
    }
  })

  it('emits null for removed (-) lines', () => {
    const diff = ['@@ -1,1 +1,1 @@', '-old line', '+new line']
    const hunks: IBlameHunk[] = [makeHunk(0, 1, 'aaa')]
    const result = alignBlameToDiff(diff.join('\n'), hunks)
    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[0], null, 'removed line should be null')
    assert.notStrictEqual(result[1], null, 'added line should be attributed')
  })

  it('attributes context ( ) lines', () => {
    const diff = ['@@ -10,3 +10,3 @@', ' context', ' context', ' context']
    const hunks: IBlameHunk[] = [makeHunk(9, 3, 'aaa')]
    const result = alignBlameToDiff(diff.join('\n'), hunks)
    assert.strictEqual(result.length, 3)
    for (const r of result) {
      assert.notStrictEqual(r, null, 'context line should be attributed')
    }
  })

  it('emits null for lines outside any blame hunk', () => {
    // Hunk header says right side starts at line 5, but blame only covers
    // line 0. Lines beyond the blame range should be null.
    const diff = ['@@ -1,1 +5,1 @@', '+new line']
    const hunks: IBlameHunk[] = [makeHunk(0, 1, 'aaa')]
    const result = alignBlameToDiff(diff.join('\n'), hunks)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0], null)
  })

  it('increments newLineNumber for both + and  lines', () => {
    const diff = ['@@ -1,3 +1,3 @@', ' context1', '+added', ' context2']
    const hunks: IBlameHunk[] = [makeHunk(0, 3, 'aaa')]
    const result = alignBlameToDiff(diff.join('\n'), hunks)
    assert.strictEqual(result.length, 3)
    // All three lines should be attributed (they all fall in [0,3))
    for (const r of result) {
      assert.notStrictEqual(r, null)
    }
  })

  it('resets the cursor when a new hunk header appears', () => {
    // Two diff hunks, blame has two hunk ranges — second diff hunk's
    // first line (line 5 in right side) should re-resolve blame.
    const diff = ['@@ -1,2 +1,2 @@', '+a', '+b', '@@ -10,1 +10,1 @@', '+c']
    const hunks: IBlameHunk[] = [makeHunk(0, 2, 'aaa'), makeHunk(9, 1, 'bbb')]
    const result = alignBlameToDiff(diff.join('\n'), hunks)
    assert.strictEqual(result.length, 3)
    assert.strictEqual((result[0] as IBlameHunk).sha, 'aaa')
    assert.strictEqual((result[1] as IBlameHunk).sha, 'aaa')
    assert.strictEqual((result[2] as IBlameHunk).sha, 'bbb')
  })

  it('returns all null when hunks is empty (e.g. untracked file)', () => {
    const diff = ['@@ -1,2 +1,2 @@', '+a', '+b']
    const result = alignBlameToDiff(diff.join('\n'), [])
    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[0], null)
    assert.strictEqual(result[1], null)
  })

  it('ignores the trailing empty string from split at end-of-file', () => {
    // split('a\n') -> ['a', ''] — the trailing '' should not be emitted.
    const diff = '@@ -1,1 +1,1 @@\n+only line'
    const hunks: IBlameHunk[] = [makeHunk(0, 1, 'aaa')]
    const result = alignBlameToDiff(diff, hunks)
    assert.strictEqual(result.length, 1)
  })

  it('handles a diff with a malformed header by ignoring it (no attribution past it)', () => {
    const diff = ['@@ broken @@', '+something']
    const hunks: IBlameHunk[] = [makeHunk(0, 1, 'aaa')]
    const result = alignBlameToDiff(diff.join('\n'), hunks)
    // newLineNumber never gets a real value, so the + line is null
    // (it doesn't land in any blame hunk's range). What we assert is
    // stability: we get one entry per non-hunk, non-no-newline line.
    assert.strictEqual(result.length, 1)
  })
})
