import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  wordWrapKey,
  wordWrapDefault,
  showLineNumbersKey,
  showLineNumbersDefault,
  useCustomEditorKey,
  useCustomShellKey,
  underlineLinksKey,
  showDiffCheckMarksKey,
  showChangesFilterKey,
} from '../../../src/lib/preferences-keys'

describe('preferences-keys', () => {
  describe('word-wrap', () => {
    it('uses kebab-case key consistent with existing preference keys', () => {
      assert.equal(wordWrapKey, 'word-wrap')
    })

    it('defaults to true so most users get word-wrap out of the box', () => {
      assert.strictEqual(wordWrapDefault, true)
    })

    it('does not collide with any existing preference key', () => {
      const existing = [
        useCustomEditorKey,
        useCustomShellKey,
        underlineLinksKey,
        showDiffCheckMarksKey,
        showChangesFilterKey,
      ]
      assert.equal(existing.includes(wordWrapKey), false)
    })
  })

  describe('diff-line-numbers-visible', () => {
    it('uses kebab-case key consistent with existing preference keys', () => {
      assert.equal(showLineNumbersKey, 'diff-line-numbers-visible')
    })

    it('defaults to true so most users see line numbers out of the box', () => {
      assert.strictEqual(showLineNumbersDefault, true)
    })

    it('does not collide with any existing preference key', () => {
      const existing = [
        useCustomEditorKey,
        useCustomShellKey,
        underlineLinksKey,
        showDiffCheckMarksKey,
        showChangesFilterKey,
        wordWrapKey,
      ]
      assert.equal(existing.includes(showLineNumbersKey), false)
    })
  })
})
