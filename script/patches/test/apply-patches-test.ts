import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  removeSnapChromeSandboxDeletion,
  applySnapChromeSandboxDeletionPatch,
} from '../apply-patches'

const buggySnippet = `        await (0, fs_extra_1.outputFile)(path.join(snapMetaDir, "snapcraft.yaml"), (0, builder_util_1.serializeToYaml)(snap));
        // Best-effort: remove chrome-sandbox from app dir before mksquashfs scans it.
        await (0, promises_1.rm)(path.join(appOutDir, "chrome-sandbox"), { force: true });
        // chmod -R g-s to avoid setgid bits in final image
`

const patchedSnippet = `        await (0, fs_extra_1.outputFile)(path.join(snapMetaDir, "snapcraft.yaml"), (0, builder_util_1.serializeToYaml)(snap));
        // chmod -R g-s to avoid setgid bits in final image
`

describe('patches/apply-patches', () => {
  describe('removeSnapChromeSandboxDeletion', () => {
    it('removes the rm call and its comment, preserving surrounding lines', () => {
      assert.equal(
        removeSnapChromeSandboxDeletion(buggySnippet),
        patchedSnippet
      )
    })

    it('is a no-op when the snippet is already absent', () => {
      assert.equal(removeSnapChromeSandboxDeletion(patchedSnippet), null)
    })

    it('is a no-op on unrelated content', () => {
      assert.equal(removeSnapChromeSandboxDeletion('console.log("hi")\n'), null)
    })
  })

  describe('applySnapChromeSandboxDeletionPatch', () => {
    it('patches a file on disk and reports the result', () => {
      const dir = mkdtempSync(join(tmpdir(), 'ghd-patch-test-'))
      const target = join(dir, 'coreLegacy.js')
      writeFileSync(target, buggySnippet)

      try {
        assert.equal(applySnapChromeSandboxDeletionPatch(target), 'patched')
        assert.equal(readFileSync(target, 'utf8'), patchedSnippet)

        // applying again must not double-patch or fail
        assert.equal(
          applySnapChromeSandboxDeletionPatch(target),
          'already-clean'
        )
        assert.equal(readFileSync(target, 'utf8'), patchedSnippet)
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })

    it('reports module-not-found without throwing for a missing file', () => {
      assert.equal(
        applySnapChromeSandboxDeletionPatch('/nonexistent/coreLegacy.js'),
        'module-not-found'
      )
    })
  })
})
