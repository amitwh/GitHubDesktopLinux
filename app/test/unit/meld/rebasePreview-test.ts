import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  parseShortStat,
  IRebaseCommitStats,
  formatStatsSummary,
} from '../../../src/lib/meld/rebasePreview'

describe('lib/meld/rebasePreview/parseShortStat', () => {
  it('parses a typical two-file shortstat summary', () => {
    const out = parseShortStat(
      ' 2 files changed, 12 insertions(+), 4 deletions(-)\n'
    )
    assert.deepStrictEqual(out, {
      filesChanged: 2,
      insertions: 12,
      deletions: 4,
    })
  })

  it('parses a single-file insertion-only summary', () => {
    const out = parseShortStat(' 1 file changed, 7 insertions(+)\n')
    assert.deepStrictEqual(out, {
      filesChanged: 1,
      insertions: 7,
      deletions: 0,
    })
  })

  it('parses a deletion-only summary', () => {
    const out = parseShortStat(' 1 file changed, 3 deletions(-)\n')
    assert.deepStrictEqual(out, {
      filesChanged: 1,
      insertions: 0,
      deletions: 3,
    })
  })

  it('parses a binary file shortstat (Bin N -> M)', () => {
    const out = parseShortStat(
      ' 1 file changed, 0 insertions(+), 0 deletions(-)\n1 file changed, some bytes...\n'
    )
    // The first line of shortstat summary is always `X files changed, ...`.
    // We extract the first such line — bit counts should be the integer
    // values shown there.
    assert.deepStrictEqual(out, {
      filesChanged: 1,
      insertions: 0,
      deletions: 0,
    })
  })

  it('returns zero stats for the empty output (initial commit / no changes)', () => {
    const out = parseShortStat('')
    assert.deepStrictEqual(out, {
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    })
  })

  it('returns zero stats for the undefined-like "no output" sentinel', () => {
    const out = parseShortStat('\n')
    assert.deepStrictEqual(out, {
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    })
  })

  it('handles trailing whitespace and leading whitespace robustly', () => {
    const out = parseShortStat(
      '  5 files changed, 42 insertions(+), 17 deletions(-)  \n'
    )
    assert.deepStrictEqual(out, {
      filesChanged: 5,
      insertions: 42,
      deletions: 17,
    })
  })

  it('returns zero stats for malformed input rather than throwing', () => {
    assert.deepStrictEqual(parseShortStat('not a shortstat'), {
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    })
    assert.deepStrictEqual(parseShortStat('5 files changed, +12 -4'), {
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    })
  })
})

describe('lib/meld/rebasePreview/formatStatsSummary', () => {
  it('formats zero stats as "no changes"', () => {
    const stats: IRebaseCommitStats = {
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    }
    assert.strictEqual(formatStatsSummary(stats), 'no changes')
  })

  it('formats a single insertion', () => {
    const stats: IRebaseCommitStats = {
      filesChanged: 1,
      insertions: 5,
      deletions: 0,
    }
    assert.strictEqual(formatStatsSummary(stats), '5 insertions, 0 deletions')
  })

  it('formats a single deletion', () => {
    const stats: IRebaseCommitStats = {
      filesChanged: 1,
      insertions: 0,
      deletions: 2,
    }
    assert.strictEqual(formatStatsSummary(stats), '0 insertions, 2 deletions')
  })

  it('formats mixed insertions + deletions', () => {
    const stats: IRebaseCommitStats = {
      filesChanged: 2,
      insertions: 42,
      deletions: 17,
    }
    assert.strictEqual(formatStatsSummary(stats), '42 insertions, 17 deletions')
  })

  it('handles large numbers without thousands separators (renderer-side formats them)', () => {
    const stats: IRebaseCommitStats = {
      filesChanged: 12,
      insertions: 1234,
      deletions: 5678,
    }
    assert.strictEqual(
      formatStatsSummary(stats),
      '1234 insertions, 5678 deletions'
    )
  })
})
