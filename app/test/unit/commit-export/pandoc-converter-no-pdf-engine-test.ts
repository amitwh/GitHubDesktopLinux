import assert from 'node:assert'
import { EventEmitter } from 'node:events'
import { Readable, Writable } from 'node:stream'
import { afterEach, describe, it, mock } from 'node:test'

interface IMockChild extends EventEmitter {
  readonly stdin: Writable
  readonly stderr: Readable
}

/**
 * This test lives in its own file so that the `pandoc-converter` module's
 * cached PDF-engine state starts cold. The companion success-path test
 * (`picks the first available engine`) is in `pandoc-converter-test.ts`.
 */
mock.module('child_process', {
  namedExports: {
    spawn: (
      _cmd: string,
      _args: ReadonlyArray<string>,
      _options: Record<string, unknown>
    ) => {
      const stdin = new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      })
      const stderr = new Readable({ read() {} })
      const child: IMockChild = Object.assign(new EventEmitter(), {
        stdin,
        stderr,
      })
      // Every `which` probe (and any pandoc spawn) reports the engine as
      // not available — simulating a fresh install with no LaTeX or
      // HTML→PDF engine.
      process.nextTick(() => child.emit('close', 1))
      return child as unknown as ReturnType<
        typeof import('node:child_process').spawn
      >
    },
  },
})

afterEach(() => {
  // Nothing to reset; the spawn mock always emits `close 1`.
})

describe('commit-export/pandoc-converter (no PDF engine available)', () => {
  it('throws an error describing installation paths when no engine is available', async () => {
    const { convertWithPandoc } = await import(
      '../../../src/lib/commit-export/pandoc-converter'
    )
    await assert.rejects(
      () => convertWithPandoc('# Hello', '/tmp/out.pdf', 'pdf'),
      (err: Error) => {
        assert.match(err.message, /No PDF engine found/)
        // Should mention at least one install hint.
        assert.match(
          err.message,
          /texlive-xetex|texlive-latex-base|wkhtmltopdf|weasyprint/
        )
        return true
      }
    )
  })
})
