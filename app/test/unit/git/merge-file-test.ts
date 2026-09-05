import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  parseMergeFileResult,
  IGitMergeFileResult,
} from '../../../src/lib/git/merge-file'

describe('git/merge-file: parseMergeFileResult', () => {
  it('parses a clean merge (exit 0) with no conflict markers as clean', () => {
    const mergedContent = 'line one\nline two\nline three'
    const result = parseMergeFileResult(mergedContent, 0)
    const expected: IGitMergeFileResult = {
      mergedContent,
      clean: true,
      conflictCount: 0,
    }
    assert.deepStrictEqual(result, expected)
  })

  it('parses exit code 1 with one conflict region as not clean', () => {
    const mergedContent =
      'start\n<<<<<<< HEAD\nours change\n=======\ntheirs change\n>>>>>>> branch\nend'
    const result = parseMergeFileResult(mergedContent, 1)
    const expected: IGitMergeFileResult = {
      mergedContent,
      clean: false,
      conflictCount: 1,
    }
    assert.deepStrictEqual(result, expected)
  })

  it('parses exit code 1 with two conflict regions as not clean with conflictCount 2', () => {
    const mergedContent =
      '<<<<<<< HEAD\nfirst ours\n=======\nfirst theirs\n>>>>>>> branch\nmiddle\n<<<<<<< HEAD\nsecond ours\n=======\nsecond theirs\n>>>>>>> branch'
    const result = parseMergeFileResult(mergedContent, 1)
    const expected: IGitMergeFileResult = {
      mergedContent,
      clean: false,
      conflictCount: 2,
    }
    assert.deepStrictEqual(result, expected)
  })

  it('parses empty merged content with exit 0 as clean', () => {
    const result = parseMergeFileResult('', 0)
    const expected: IGitMergeFileResult = {
      mergedContent: '',
      clean: true,
      conflictCount: 0,
    }
    assert.deepStrictEqual(result, expected)
  })

  it('treats exit code 0 with markers as clean (markers were stripped)', () => {
    // git merge-file --union may return exit 0 even if it wrote markers;
    // the parser counts markers so this would be conflictCount > 0,
    // but the contract says exit 0 means clean per git merge-file spec
    const contentWithMarkers =
      '<<<<<<< HEAD\ntext\n=======\ntext\n>>>>>>> branch'
    const result = parseMergeFileResult(contentWithMarkers, 0)
    // When exit is 0 we trust the exit code over marker count
    assert.strictEqual(result.clean, true)
    assert.strictEqual(result.conflictCount, 0)
  })

  it('counts all <<<<<<< markers regardless of adjacent content', () => {
    const content =
      '<<<<<<< HEAD\na\n=======\nb\n>>>>>>> branch\n<<<<<<< HEAD\nc\n=======\nd\n>>>>>>> branch\n<<<<<<< HEAD\ne\n=======\nf\n>>>>>>> branch'
    const result = parseMergeFileResult(content, 1)
    assert.strictEqual(result.conflictCount, 3)
    assert.strictEqual(result.clean, false)
  })
})
