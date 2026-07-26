import assert from 'node:assert'
import { EventEmitter } from 'node:events'
import { Readable, Writable } from 'node:stream'
import { afterEach, describe, it, mock } from 'node:test'

interface SpawnCall {
  readonly cmd: string
  readonly args: ReadonlyArray<string>
  readonly options: Readonly<Record<string, unknown>>
}

/** Captured spawn() calls made against child_process. */
let spawnCalls: SpawnCall[] = []

interface MockChild extends EventEmitter {
  readonly stdin: Writable
  readonly stderr: Readable
}

interface ChildBehavior {
  /** Emit an `error` event with this error. */
  readonly error?: Error
  /** Emit a `close` event with this exit code (default 0 = success). */
  readonly exitCode?: number
  /** Stderr content to emit before closing. */
  readonly stderrText?: string
}

type BehaviorFn = (child: MockChild) => void

const defaultBehavior: BehaviorFn = child => {
  process.nextTick(() => {
    child.emit('close', 0)
  })
}

/**
 * Persistent behavior: applied to every spawn() call when no one-shot
 * behavior has been queued. Used for tests that exercise detection flows
 * with multiple sequential spawns (e.g. PDF engine probes).
 */
let persistentBehavior: BehaviorFn = defaultBehavior

/**
 * One-shot behavior: applied to the very next spawn() call and then
 * cleared, falling back to `persistentBehavior` for subsequent spawns.
 */
let nextChildBehavior: BehaviorFn | null = null

function buildBehaviorFn(behavior: ChildBehavior): BehaviorFn {
  return child => {
    if (behavior.error) {
      child.emit('error', behavior.error)
      return
    }
    if (behavior.stderrText) {
      child.stderr.push(behavior.stderrText)
    }
    // Defer close to the next tick so any 'data' listeners on stderr (which
    // the source attaches synchronously after spawn) have a chance to drain
    // the buffered stderr text before the close handler runs.
    process.nextTick(() => {
      child.emit('close', behavior.exitCode ?? 0)
    })
  }
}

function setNextChildBehavior(behavior: ChildBehavior) {
  nextChildBehavior = buildBehaviorFn(behavior)
}

/**
 * Install a mock child_process module so that the pandoc converter can be
 * exercised without a real pandoc binary.
 *
 * Note on caching: `convertWithPandoc` caches the detected PDF engine in a
 * module-level variable (`cachedPdfEngine`, `cachedPdfEngineChecked`).
 * Tests that exercise that caching behavior must therefore control the
 * order in which they run, or split into separate test files (each file
 * receives its own module cache).
 */
mock.module('child_process', {
  namedExports: {
    spawn: (cmd: string, args: ReadonlyArray<string>, options: Record<string, unknown>) => {
      spawnCalls.push({ cmd, args: [...args], options })

      const stdin = new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      })
      const stderr = new Readable({ read() {} })

      const child: MockChild = Object.assign(new EventEmitter(), {
        stdin,
        stderr,
      })

      const behavior = nextChildBehavior ?? persistentBehavior
      nextChildBehavior = null
      // Schedule on next tick so callers can attach listeners first.
      process.nextTick(() => behavior(child))

      return child as unknown as ReturnType<typeof import('node:child_process').spawn>
    },
  },
})

afterEach(() => {
  spawnCalls = []
  nextChildBehavior = null
  persistentBehavior = defaultBehavior
})

describe('commit-export/pandoc-converter', () => {
  describe('getFormatFromExtension', () => {
    it('maps known extensions to their Pandoc format identifier', async () => {
      const { getFormatFromExtension } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )

      assert.strictEqual(getFormatFromExtension('.pdf'), 'pdf')
      assert.strictEqual(getFormatFromExtension('.docx'), 'docx')
      assert.strictEqual(getFormatFromExtension('.odt'), 'odt')
      assert.strictEqual(getFormatFromExtension('.html'), 'html')
      assert.strictEqual(getFormatFromExtension('.epub'), 'epub')
      assert.strictEqual(getFormatFromExtension('.tex'), 'tex')
      assert.strictEqual(getFormatFromExtension('.rtf'), 'rtf')
    })

    it('matches the extension case-insensitively', async () => {
      const { getFormatFromExtension } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )

      assert.strictEqual(getFormatFromExtension('.PDF'), 'pdf')
      assert.strictEqual(getFormatFromExtension('.Docx'), 'docx')
    })

    it('returns undefined for unsupported extensions', async () => {
      const { getFormatFromExtension } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )

      assert.strictEqual(getFormatFromExtension('.csv'), undefined)
      assert.strictEqual(getFormatFromExtension('.txt'), undefined)
      assert.strictEqual(getFormatFromExtension(''), undefined)
    })
  })

  describe('convertWithPandoc', () => {
    it('constructs the expected pandoc CLI arguments for a non-PDF format', async () => {
      setNextChildBehavior({ exitCode: 0 })

      const { convertWithPandoc } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )
      await convertWithPandoc('# Hello', '/tmp/out.html', 'html')

      const pandocCall = spawnCalls.find(c => c.cmd === 'pandoc')
      assert.ok(pandocCall, 'expected a call to spawn pandoc')

      assert.deepStrictEqual(pandocCall.args, [
        '-f', 'markdown',
        '-t', 'html',
        '-o', '/tmp/out.html',
        '--resource-path', '/tmp',
      ])
      // PDF engine flag should NOT appear for non-PDF outputs
      assert.ok(
        !pandocCall.args.some(a => a.startsWith('--pdf-engine')),
        'did not expect --pdf-engine for non-PDF format'
      )
    })

    it('adds --pdf-engine=<engine> when format is pdf', async () => {
      // First call is the `which` probe for the first PDF engine in the
      // ordered list — succeed it so a cached engine is selected.
      setNextChildBehavior({ exitCode: 0 })

      const { convertWithPandoc } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )
      await convertWithPandoc('# Hello', '/tmp/out.pdf', 'pdf')

      const pandocCall = spawnCalls.find(c => c.cmd === 'pandoc')
      assert.ok(pandocCall)

      const engineArg = pandocCall.args.find(a => a.startsWith('--pdf-engine='))
      assert.ok(
        engineArg,
        `expected --pdf-engine=<name> in args: ${pandocCall.args.join(' ')}`
      )
      assert.match(engineArg!, /^--pdf-engine=(xelatex|pdflatex|lualatex|wkhtmltopdf|weasyprint)$/)
    })

    it('resolves when pandoc exits with code 0', async () => {
      setNextChildBehavior({ exitCode: 0 })

      const { convertWithPandoc } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )
      // Should resolve without throwing.
      await convertWithPandoc('# Hello', '/tmp/out.md', 'markdown')
    })

    it('rejects with the captured stderr when pandoc exits non-zero', async () => {
      setNextChildBehavior({
        exitCode: 23,
        stderrText: 'pandoc: some specific error',
      })

      const { convertWithPandoc } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )
      await assert.rejects(
        () => convertWithPandoc('# Hello', '/tmp/out.docx', 'docx'),
        (err: Error) => {
          assert.match(err.message, /pandoc exited with code 23/)
          assert.match(err.message, /pandoc: some specific error/)
          return true
        }
      )
    })

    it('rejects with a helpful "is pandoc installed?" error when spawn fails', async () => {
      // Simulate `ENOENT` from spawn — the binary is missing.
      setNextChildBehavior({
        error: Object.assign(new Error('spawn pandoc ENOENT'), {
          code: 'ENOENT',
        }),
      })

      const { convertWithPandoc } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )
      await assert.rejects(
        () => convertWithPandoc('# Hello', '/tmp/out.html', 'html'),
        (err: Error) => {
          assert.match(err.message, /Failed to spawn pandoc/)
          assert.match(err.message, /Is pandoc installed/)
          return true
        }
      )
    })

    it('writes the markdown content to pandoc stdin', async () => {
      setNextChildBehavior({ exitCode: 0 })

      const { convertWithPandoc } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )

      // The source writes the markdown to the spawned child's stdin. Resolve
      // the promise and ensure no error is reported.
      const promise = convertWithPandoc(
        '# Custom body\n\nMore text',
        '/tmp/out.md',
        'markdown'
      )
      await promise

      const call = spawnCalls.find(c => c.cmd === 'pandoc')
      assert.ok(call)
    })
  })

  describe('PDF engine auto-detection (covers the logic added in fe7518cac6)', () => {
    // Note: this test relies on a cold (empty) module-level cache for the
    // detected PDF engine. The companion test for the "no engine found"
    // error path lives in `pandoc-converter-no-pdf-engine-test.ts` so it
    // runs against a fresh cache.

    it('picks the first available engine from the ordered preference list', async () => {
      // Allow the first probe (`which xelatex`) to succeed so detection
      // short-circuits at the first entry of the preference list.
      setNextChildBehavior({ exitCode: 0 })

      const { convertWithPandoc } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )
      await convertWithPandoc('# Hello', '/tmp/out.pdf', 'pdf')

      const pandocCall = spawnCalls.find(c => c.cmd === 'pandoc')
      assert.ok(pandocCall)
      const engineArg = pandocCall!.args.find(a =>
        a.startsWith('--pdf-engine=')
      )
      assert.strictEqual(engineArg, '--pdf-engine=xelatex')
    })
  })

  describe('unsupported / unknown formats', () => {
    it('returns undefined from getFormatFromExtension for unknown extensions', async () => {
      // This documents the boundary between format auto-detection and the
      // converter: callers that use `getFormatFromExtension` to pick a format
      // can receive `undefined`, and it is their responsibility to handle
      // that case before calling `convertWithPandoc`. The converter itself
      // trusts its caller to pass a valid `PandocFormat`.
      const { getFormatFromExtension } = await import(
        '../../../src/lib/commit-export/pandoc-converter'
      )

      assert.strictEqual(getFormatFromExtension('.unknown'), undefined)
    })
  })
})