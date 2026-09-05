import { describe, it } from 'node:test'
import assert from 'node:assert'
import { substituteArgs } from '../../../src/lib/meld/external-tool-args'
import { IExternalTool } from '../../../src/models/external-tool'

describe('external-tool-args/substituteArgs', () => {
  const tool: IExternalTool = {
    id: 'meld',
    name: 'Meld',
    command: 'meld',
    args: '%L %R',
    builtIn: true,
  }

  it('substitutes %L with the left path', () => {
    const result = substituteArgs(tool, {
      leftPath: '/tmp/a.txt',
      rightPath: '/tmp/b.txt',
    })
    assert.deepEqual(result, ['meld', '/tmp/a.txt', '/tmp/b.txt'])
  })

  it('substitutes %R with the right path', () => {
    const result = substituteArgs(tool, {
      leftPath: '/tmp/a.txt',
      rightPath: '/tmp/b.txt',
    })
    assert.equal(result[2], '/tmp/b.txt')
  })

  it('substitutes %B with the base path when provided', () => {
    const threeWayTool: IExternalTool = { ...tool, args: '%B %L %R' }
    const result = substituteArgs(threeWayTool, {
      leftPath: '/tmp/a.txt',
      rightPath: '/tmp/b.txt',
      basePath: '/tmp/base.txt',
    })
    assert.deepEqual(result, [
      'meld',
      '/tmp/base.txt',
      '/tmp/a.txt',
      '/tmp/b.txt',
    ])
  })

  it('throws when %B is requested but basePath is not provided', () => {
    const threeWayTool: IExternalTool = { ...tool, args: '%B %L %R' }
    assert.throws(
      () =>
        substituteArgs(threeWayTool, {
          leftPath: '/tmp/a.txt',
          rightPath: '/tmp/b.txt',
        }),
      (err: unknown) => {
        return err instanceof Error && /basePath is required/.test(err.message)
      }
    )
  })

  it('substitutes paths with spaces correctly without quoting (caller quotes)', () => {
    const result = substituteArgs(tool, {
      leftPath: '/tmp/with space/a.txt',
      rightPath: '/tmp/with space/b.txt',
    })
    assert.deepEqual(result, [
      'meld',
      '/tmp/with space/a.txt',
      '/tmp/with space/b.txt',
    ])
  })
})
