import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  computeCharDiff,
  copyHunk,
  revertEdits,
  applyEdit,
  ICharDiffPart,
} from '../../../src/lib/meld/diffOperations'
import { IMeldEditState } from '../../../src/models/meld-edit'

describe('diffOperations/computeCharDiff', () => {
  it('returns a single equal part when the strings are identical', () => {
    const parts = computeCharDiff('hello', 'hello')
    assert.strictEqual(parts.length, 1)
    assert.strictEqual(parts[0].value, 'hello')
    assert.strictEqual(parts[0].added, undefined)
    assert.strictEqual(parts[0].removed, undefined)
  })

  it('marks inserted characters as added', () => {
    const parts = computeCharDiff('hello', 'hellxo')
    const added = parts.filter(p => p.added === true)
    assert.ok(added.length > 0, 'expected at least one added part')
    const allAddedText = added.map(p => p.value).join('')
    assert.strictEqual(allAddedText, 'x')
  })

  it('marks removed characters as removed', () => {
    const parts = computeCharDiff('hellxo', 'hello')
    const removed = parts.filter(p => p.removed === true)
    assert.ok(removed.length > 0, 'expected at least one removed part')
    const allRemovedText = removed.map(p => p.value).join('')
    assert.strictEqual(allRemovedText, 'x')
  })

  it('returns a mix of equal, removed, and added parts for a typical change', () => {
    const parts: ReadonlyArray<ICharDiffPart> = computeCharDiff(
      'foo bar',
      'foo baz'
    )
    const equalText = parts
      .filter(p => !p.added && !p.removed)
      .map(p => p.value)
      .join('')
    assert.ok(equalText.includes('foo '), 'expected "foo " to be unchanged')
  })

  it('handles empty left string (pure addition)', () => {
    const parts = computeCharDiff('', 'new content')
    const added = parts.filter(p => p.added === true)
    assert.ok(added.length > 0)
    assert.strictEqual(added.map(p => p.value).join(''), 'new content')
  })

  it('handles empty right string (pure removal)', () => {
    const parts = computeCharDiff('old content', '')
    const removed = parts.filter(p => p.removed === true)
    assert.ok(removed.length > 0)
    assert.strictEqual(removed.map(p => p.value).join(''), 'old content')
  })
})

describe('diffOperations/copyHunk', () => {
  it('replaces the target hunk range with source lines', () => {
    const source = 'line1\nline2\nline3'
    const target = 'lineA\nlineB\nlineC'
    const result = copyHunk(source, target, { start: 0, end: 0 })
    // Source lines 0..0 (inclusive) = ['line1']; target line 0 replaced
    assert.strictEqual(result, 'line1\nlineB\nlineC')
  })

  it('copies a multi-line hunk', () => {
    const source = 'src1\nsrc2\nsrc3'
    const target = 'tgt1\ntgt2\ntgt3'
    const result = copyHunk(source, target, { start: 0, end: 1 })
    // Replace target[0..1] with source[0..1] → ['src1', 'src2']
    assert.strictEqual(result, 'src1\nsrc2\ntgt3')
  })

  it('appends at end when hunk extends past the target length', () => {
    const source = 'src1\nsrc2'
    const target = 'tgt1'
    const result = copyHunk(source, target, { start: 1, end: 5 })
    // Source lines 1..(clamped) = ['src2']; target[1..5] doesn't exist, so append
    assert.strictEqual(result, 'tgt1\nsrc2')
  })

  it('appends the first source line when hunk range is past the source', () => {
    const source = 'src1'
    const target = 'tgt1\ntgt2'
    // Both start and end equal, pointing past the target — insert source[0] at end
    const result = copyHunk(source, target, { start: 5, end: 5 })
    assert.strictEqual(result, 'tgt1\ntgt2\nsrc1')
  })
})

describe('diffOperations/revertEdits', () => {
  const original: IMeldEditState = {
    leftContent: 'original left',
    rightContent: 'original right',
    leftOriginal: 'original left',
    rightOriginal: 'original right',
    hasChanges: false,
  }

  it('restores both panes to the original content', () => {
    const edited: IMeldEditState = {
      ...original,
      leftContent: 'edited left',
      rightContent: 'edited right',
      hasChanges: true,
    }
    const reverted = revertEdits(edited)
    assert.strictEqual(reverted.leftContent, 'original left')
    assert.strictEqual(reverted.rightContent, 'original right')
    assert.strictEqual(reverted.hasChanges, false)
  })

  it('preserves the originals for future reverts', () => {
    const edited: IMeldEditState = {
      ...original,
      leftContent: 'edited',
      hasChanges: true,
    }
    const reverted = revertEdits(edited)
    assert.strictEqual(reverted.leftOriginal, 'original left')
    assert.strictEqual(reverted.rightOriginal, 'original right')
  })

  it('leaves unchanged state alone', () => {
    const reverted = revertEdits(original)
    assert.strictEqual(reverted.leftContent, 'original left')
    assert.strictEqual(reverted.hasChanges, false)
  })
})

describe('diffOperations/applyEdit', () => {
  const original: IMeldEditState = {
    leftContent: 'left',
    rightContent: 'right',
    leftOriginal: 'left',
    rightOriginal: 'right',
    hasChanges: false,
  }

  it('updates the left content and recomputes hasChanges', () => {
    const next = applyEdit(original, 'left', 'left edited')
    assert.strictEqual(next.leftContent, 'left edited')
    assert.strictEqual(next.rightContent, 'right')
    assert.strictEqual(next.hasChanges, true)
  })

  it('updates the right content and recomputes hasChanges', () => {
    const next = applyEdit(original, 'right', 'right edited')
    assert.strictEqual(next.rightContent, 'right edited')
    assert.strictEqual(next.hasChanges, true)
  })

  it('clears hasChanges when the new content matches the original', () => {
    const edited: IMeldEditState = {
      ...original,
      leftContent: 'left edited',
      hasChanges: true,
    }
    const next = applyEdit(edited, 'left', 'left')
    assert.strictEqual(next.hasChanges, false)
  })

  it('preserves the original content for future reverts', () => {
    const next = applyEdit(original, 'left', 'left edited')
    assert.strictEqual(next.leftOriginal, 'left')
    assert.strictEqual(next.rightOriginal, 'right')
  })
})
