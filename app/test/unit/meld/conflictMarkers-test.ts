import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  parseConflictMarkers,
  synthesizeMerge,
  applyHunkResolution,
  buildConflictHunks,
} from '../../../src/lib/meld/conflictMarkers'

describe('conflictMarkers/parseConflictMarkers', () => {
  it('returns 1 context region when no conflict markers are present', () => {
    const merged = 'line one\nline two\nline three'
    const regions = parseConflictMarkers(merged)
    assert.strictEqual(regions.length, 1)
    assert.strictEqual(regions[0].kind, 'context')
    assert.strictEqual(regions[0].content, 'line one\nline two\nline three')
    assert.strictEqual(regions[0].startLine, 0)
    assert.strictEqual(regions[0].endLine, 2)
  })

  it('returns 3 context + 2 conflict regions for text with 2 conflict blocks', () => {
    const merged = [
      'start context',
      '<<<<<<< HEAD',
      'local1',
      '||||||| base',
      'base1',
      '=======',
      'remote1',
      '>>>>>>> br1',
      'middle context',
      '<<<<<<< HEAD',
      'local2',
      '||||||| base',
      'base2',
      '=======',
      'remote2',
      '>>>>>>> br2',
      'end context',
    ].join('\n')
    const regions = parseConflictMarkers(merged)
    // Should have: context (start) + conflict(1) + context(middle) + conflict(2) + context(end)
    const contextRegions = regions.filter(r => r.kind === 'context')
    const conflictRegions = regions.filter(r => r.kind === 'conflict')
    assert.strictEqual(contextRegions.length, 3, 'expected 3 context regions')
    assert.strictEqual(conflictRegions.length, 2, 'expected 2 conflict regions')
  })

  it('handles 3-marker variant (no |||||||) with empty baseContent', () => {
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'local line',
      '=======',
      'remote line',
      '>>>>>>> branch',
      'end',
    ].join('\n')
    const regions = parseConflictMarkers(merged)
    const conflictRegion = regions.find(r => r.kind === 'conflict')
    assert.ok(conflictRegion !== undefined, 'expected at least one conflict region')
    if (conflictRegion.kind === 'conflict') {
      assert.strictEqual(conflictRegion.hunk.baseContent, '', 'baseContent should be empty for 3-marker variant')
      assert.strictEqual(conflictRegion.hunk.localContent, 'local line')
      assert.strictEqual(conflictRegion.hunk.remoteContent, 'remote line')
    }
  })

  it('handles 4-marker variant (with ||||||| base)', () => {
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'local line',
      '||||||| base',
      'base line',
      '=======',
      'remote line',
      '>>>>>>> branch',
      'end',
    ].join('\n')
    const regions = parseConflictMarkers(merged)
    const conflictRegion = regions.find(r => r.kind === 'conflict')
    assert.ok(conflictRegion !== undefined)
    if (conflictRegion.kind === 'conflict') {
      assert.strictEqual(conflictRegion.hunk.baseContent, 'base line')
      assert.strictEqual(conflictRegion.hunk.localContent, 'local line')
      assert.strictEqual(conflictRegion.hunk.remoteContent, 'remote line')
    }
  })

  it('sets correct startLine/endLine (0-indexed, inclusive endLine)', () => {
    const merged = [
      'line0',
      '<<<<<<< HEAD',
      'local',
      '=======',
      'remote',
      '>>>>>>> branch',
      'line6',
    ].join('\n')
    const regions = parseConflictMarkers(merged)
    const conflictRegion = regions.find(r => r.kind === 'conflict')
    assert.ok(conflictRegion !== undefined)
    if (conflictRegion.kind === 'conflict') {
      assert.strictEqual(conflictRegion.hunk.startLine, 1)
      assert.strictEqual(conflictRegion.hunk.endLine, 5, 'endLine is inclusive of >>>>>>> line')
    }
  })
})

describe('conflictMarkers/synthesizeMerge', () => {
  it('round-trips with parseConflictMarkers (no conflicts)', () => {
    const original = 'no conflict here\nstill fine'
    const regions = parseConflictMarkers(original)
    const synthesized = synthesizeMerge(regions)
    assert.strictEqual(synthesized, original)
  })

  it('round-trips with parseConflictMarkers (single conflict)', () => {
    // baseLabel/endLabel are YAGNI — synthesizeMerge emits bare ||||||| and >>>>>>> HEAD
    const merged = [
      'pre',
      '<<<<<<< HEAD',
      'local',
      '|||||||',
      'base',
      '=======',
      'remote',
      '>>>>>>> HEAD',
      'post',
    ].join('\n')
    const regions = parseConflictMarkers(merged)
    const synthesized = synthesizeMerge(regions)
    assert.strictEqual(synthesized, merged)
  })

  it('round-trips with parseConflictMarkers (multiple conflicts)', () => {
    // baseLabel/endLabel are YAGNI — synthesizeMerge emits bare ||||||| and >>>>>>> HEAD
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'L1',
      '|||||||',
      'B1',
      '=======',
      'R1',
      '>>>>>>> HEAD',
      'middle',
      '<<<<<<< HEAD',
      'L2',
      '|||||||',
      'B2',
      '=======',
      'R2',
      '>>>>>>> HEAD',
      'end',
    ].join('\n')
    const regions = parseConflictMarkers(merged)
    const synthesized = synthesizeMerge(regions)
    assert.strictEqual(synthesized, merged)
  })

  it('round-trips with parseConflictMarkers (3-marker variant)', () => {
    // endLabel is YAGNI — synthesizeMerge always emits >>>>>>> HEAD
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'local',
      '=======',
      'remote',
      '>>>>>>> HEAD',
      'end',
    ].join('\n')
    const regions = parseConflictMarkers(merged)
    const synthesized = synthesizeMerge(regions)
    assert.strictEqual(synthesized, merged)
  })
})

describe('conflictMarkers/applyHunkResolution', () => {
  const merged = [
    'context before',
    '<<<<<<< HEAD',
    'local content',
    '||||||| base',
    'base content',
    '=======',
    'remote content',
    '>>>>>>> branch',
    'context after',
  ].join('\n')

  it('side local replaces the conflict with localContent', () => {
    const result = applyHunkResolution(merged, 0, 'local')
    assert.ok(!result.includes('<<<<<<<'), 'should not contain <<<<<<< marker')
    assert.ok(!result.includes('|||||||'), 'should not contain ||||||| marker')
    assert.ok(!result.includes('======='), 'should not contain ======= marker')
    assert.ok(!result.includes('>>>>>>>'), 'should not contain >>>>>>> marker')
    assert.ok(result.includes('local content'), 'should contain local content')
    assert.ok(result.includes('context before'), 'should preserve context before')
    assert.ok(result.includes('context after'), 'should preserve context after')
  })

  it('side remote replaces the conflict with remoteContent', () => {
    const result = applyHunkResolution(merged, 0, 'remote')
    assert.ok(!result.includes('<<<<<<<'), 'should not contain <<<<<<< marker')
    assert.ok(result.includes('remote content'), 'should contain remote content')
    assert.ok(result.includes('context before'), 'should preserve context before')
    assert.ok(result.includes('context after'), 'should preserve context after')
  })

  it('side base replaces the conflict with baseContent (non-empty base)', () => {
    const result = applyHunkResolution(merged, 0, 'base')
    assert.ok(!result.includes('<<<<<<<'), 'should not contain <<<<<<< marker')
    assert.ok(result.includes('base content'), 'should contain base content')
    assert.ok(result.includes('context before'), 'should preserve context after')
  })

  it('side base replaces with empty when baseContent is empty (3-marker variant)', () => {
    const merged3marker = [
      'context',
      '<<<<<<< HEAD',
      'local',
      '=======',
      'remote',
      '>>>>>>> branch',
      'end',
    ].join('\n')
    const result = applyHunkResolution(merged3marker, 0, 'base')
    assert.ok(!result.includes('<<<<<<<'), 'should not contain <<<<<<< marker')
    assert.ok(!result.includes('======='), 'should not contain ======= marker')
    // When base is empty, base resolution removes the entire conflict region
    assert.ok(!result.includes('local'), 'should not contain local content')
    assert.ok(!result.includes('remote'), 'should not contain remote content')
    assert.ok(result.includes('context'), 'should preserve leading context')
    assert.ok(result.includes('end'), 'should preserve trailing context')
  })

  it('applies resolution to the correct hunk when multiple conflicts exist', () => {
    const multiMerged = [
      'c1',
      '<<<<<<< HEAD',
      'L1',
      '||||||| B1',
      'B1',
      '=======',
      'R1',
      '>>>>>>> b1',
      'c2',
      '<<<<<<< HEAD',
      'L2',
      '||||||| B2',
      'B2',
      '=======',
      'R2',
      '>>>>>>> b2',
      'c3',
    ].join('\n')
    // Resolve second hunk (index 1) with local
    const result = applyHunkResolution(multiMerged, 1, 'local')
    // First conflict should remain unchanged
    assert.ok(result.includes('<<<<<<<'), 'first conflict should remain')
    assert.ok(result.includes('L1'), 'first local should remain')
    // Second conflict should be resolved
    assert.ok(!result.split('>>>>>>> b1')[1].includes('<<<<<<<'), 'second conflict should be resolved')
  })
})

describe('conflictMarkers/buildConflictHunks', () => {
  it('returns one entry per <<<<<<< marker', () => {
    const merged = [
      'start',
      '<<<<<<< HEAD',
      'local1',
      '||||||| b1',
      'b1',
      '=======',
      'remote1',
      '>>>>>>> br1',
      'middle',
      '<<<<<<< HEAD',
      'local2',
      '||||||| b2',
      'b2',
      '=======',
      'remote2',
      '>>>>>>> br2',
      'end',
    ].join('\n')
    const hunks = buildConflictHunks(merged)
    assert.strictEqual(hunks.length, 2, 'should have 2 hunks for 2 <<<<<<< markers')
  })

  it('returns empty array when no conflicts', () => {
    const merged = 'no conflicts here'
    const hunks = buildConflictHunks(merged)
    assert.strictEqual(hunks.length, 0)
  })

  it('returns correct hunk positions for 4-marker variant', () => {
    const merged = [
      'line0',
      '<<<<<<< HEAD',
      'L',
      '||||||| B',
      'B',
      '=======',
      'R',
      '>>>>>>> br',
    ].join('\n')
    const hunks = buildConflictHunks(merged)
    assert.strictEqual(hunks.length, 1)
    assert.strictEqual(hunks[0].startLine, 1)
    assert.strictEqual(hunks[0].endLine, 7)
    assert.strictEqual(hunks[0].localContent, 'L')
    assert.strictEqual(hunks[0].baseContent, 'B')
    assert.strictEqual(hunks[0].remoteContent, 'R')
  })

  it('handles 3-marker variant with empty baseContent', () => {
    const merged = [
      'line0',
      '<<<<<<< HEAD',
      'local',
      '=======',
      'remote',
      '>>>>>>> branch',
    ].join('\n')
    const hunks = buildConflictHunks(merged)
    assert.strictEqual(hunks.length, 1)
    assert.strictEqual(hunks[0].baseContent, '', 'baseContent should be empty for 3-marker')
    assert.strictEqual(hunks[0].localContent, 'local')
    assert.strictEqual(hunks[0].remoteContent, 'remote')
  })
})