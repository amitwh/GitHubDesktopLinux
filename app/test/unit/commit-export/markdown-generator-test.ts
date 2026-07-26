import assert from 'node:assert'
import { describe, it } from 'node:test'

import { generateMarkdown, IMarkdownGeneratorOptions } from '../../../src/lib/commit-export/markdown-generator'
import { Commit } from '../../../src/models/commit'
import { CommitIdentity } from '../../../src/models/commit-identity'

function makeCommit(opts: {
  readonly sha?: string
  readonly shortSha?: string
  readonly summary: string
  readonly body?: string
  readonly authorName?: string
  readonly authorEmail?: string
  readonly authorDate?: Date
}): Commit {
  const date = opts.authorDate ?? new Date('2026-01-15T10:30:00.000Z')
  const author = new CommitIdentity(
    opts.authorName ?? 'Mona Lisa',
    opts.authorEmail ?? 'mona@example.com',
    date
  )
  const committer = new CommitIdentity(
    opts.authorName ?? 'Mona Lisa',
    opts.authorEmail ?? 'mona@example.com',
    date
  )
  return new Commit(
    opts.sha ?? 'abc1234567890abcdef1234567890abcdef12345',
    opts.shortSha ?? 'abc1234',
    opts.summary,
    opts.body ?? '',
    author,
    committer,
    [],
    [],
    []
  )
}

const allFieldsOn: IMarkdownGeneratorOptions = {
  includeHash: true,
  includeAuthor: true,
  includeDate: true,
  includeMessage: true,
  includeStats: true,
}

describe('commit-export/markdown-generator', () => {
  describe('generateMarkdown', () => {
    it('emits a header-only document when the commit list is empty', () => {
      const md = generateMarkdown([], 'demo-repo', allFieldsOn)

      // The header must always be present, regardless of commit count
      assert.match(md, /^# Commit History: demo-repo/)
      assert.match(md, /Total commits: 0/)
      // No commit body lines should follow the initial separator
      const afterFirstSeparator = md.split('\n---\n')[1] ?? ''
      assert.strictEqual(afterFirstSeparator.trim(), '')
    })

    it('renders the short SHA, author, ISO date, summary, and body for a single commit', () => {
      const date = new Date('2026-02-01T12:00:00.000Z')
      const commit = makeCommit({
        sha: '1234567890abcdef1234567890abcdef12345678',
        shortSha: '1234567',
        summary: 'Add login screen',
        body: 'Adds the new login form and routes.',
        authorName: 'Ada Lovelace',
        authorEmail: 'ada@example.com',
        authorDate: date,
      })

      const md = generateMarkdown([commit], 'demo-repo', allFieldsOn)

      assert.ok(md.includes('**1234567**'))
      assert.ok(md.includes('2026-02-01T12:00:00.000Z'))
      assert.ok(md.includes('*Ada Lovelace*'))
      assert.ok(md.includes('Add login screen'))
      assert.ok(md.includes('Adds the new login form and routes.'))
    })

    it('separates multiple commits with a triple-dashed horizontal rule', () => {
      const commits = [
        makeCommit({ summary: 'First commit' }),
        makeCommit({ summary: 'Second commit' }),
        makeCommit({ summary: 'Third commit' }),
      ]

      const md = generateMarkdown(commits, 'demo-repo', allFieldsOn)

      // There should be one separator after the header, plus one per commit
      const separatorCount = (md.match(/^---$/gm) ?? []).length
      assert.strictEqual(separatorCount, 1 + commits.length)

      // The summaries must appear in order
      const firstIdx = md.indexOf('First commit')
      const secondIdx = md.indexOf('Second commit')
      const thirdIdx = md.indexOf('Third commit')
      assert.ok(firstIdx > -1 && secondIdx > firstIdx && thirdIdx > secondIdx)
      assert.ok(md.includes('Total commits: 3'))
    })

    it('omits the hash line when includeHash is false', () => {
      const commit = makeCommit({ shortSha: 'abcdef0', summary: 'foo' })

      const md = generateMarkdown([commit], 'demo-repo', {
        ...allFieldsOn,
        includeHash: false,
      })

      assert.ok(!md.includes('**abcdef0**'))
      // Other fields should still be rendered
      assert.ok(md.includes('foo'))
    })

    it('omits the author line when includeAuthor is false', () => {
      const commit = makeCommit({ authorName: 'Should Not Appear', summary: 'foo' })

      const md = generateMarkdown([commit], 'demo-repo', {
        ...allFieldsOn,
        includeAuthor: false,
      })

      assert.ok(!md.includes('*Should Not Appear*'))
    })

    it('omits the date line when includeDate is false', () => {
      const md = generateMarkdown(
        [makeCommit({ summary: 'foo', authorDate: new Date('2030-01-01T00:00:00.000Z') })],
        'demo-repo',
        { ...allFieldsOn, includeDate: false }
      )

      assert.ok(!md.includes('2030-01-01T00:00:00.000Z'))
    })

    it('omits the summary and body lines when includeMessage is false', () => {
      const commit = makeCommit({
        summary: 'Should Not Appear',
        body: 'Neither should this body.',
      })

      const md = generateMarkdown([commit], 'demo-repo', {
        ...allFieldsOn,
        includeMessage: false,
      })

      assert.ok(!md.includes('Should Not Appear'))
      assert.ok(!md.includes('Neither should this body.'))
      // SHA should still be present
      assert.ok(md.includes('**abc1234**'))
    })

    it('does not include the body when it is empty', () => {
      const commit = makeCommit({
        summary: 'Just a title',
        body: '',
      })

      const md = generateMarkdown([commit], 'demo-repo', allFieldsOn)

      // The summary appears once (no blank-line + body follow-up)
      const occurrences = md.split('Just a title').length - 1
      assert.strictEqual(occurrences, 1)
    })

    it('escapes nothing — passes raw content through verbatim', () => {
      // This documents the current behavior: the generator intentionally does
      // not HTML-escape. This is acceptable for Markdown targets (where
      // escaping is rarely needed) but is documented here so that any future
      // change to add escaping is intentional and reviewed.
      const commit = makeCommit({
        shortSha: '<sha>',
        summary: 'feat: <script>alert("xss")</script>',
        body: 'Body with `code` and **bold** and [link](http://example.com)',
        authorName: '<author>',
      })

      const md = generateMarkdown([commit], 'demo-repo', allFieldsOn)

      assert.ok(md.includes('**<sha>**'))
      assert.ok(md.includes('*<author>*'))
      assert.ok(md.includes('feat: <script>alert("xss")</script>'))
      assert.ok(
        md.includes('Body with `code` and **bold** and [link](http://example.com)')
      )
    })

    it('always includes the repo name in the title and a "Total commits" line', () => {
      const md1 = generateMarkdown([], 'repo-alpha', allFieldsOn)
      const md2 = generateMarkdown(
        [makeCommit({ summary: 'x' })],
        'repo-beta',
        allFieldsOn
      )

      assert.ok(md1.includes('# Commit History: repo-alpha'))
      assert.ok(md2.includes('# Commit History: repo-beta'))
      assert.ok(md1.includes('Total commits: 0'))
      assert.ok(md2.includes('Total commits: 1'))
    })

    it('uses ISO 8601 (UTC) for the generated-on timestamp', () => {
      const md = generateMarkdown([], 'demo-repo', allFieldsOn)

      // Matches a date produced by Date.prototype.toISOString() — the letter T
      // separator and a Z-suffixed timezone.
      const match = md.match(/\*Generated on ([\dTZ.:-]+)\*/)
      assert.ok(match)
      const isoString = match![1]
      const parsed = new Date(isoString)
      assert.ok(!isNaN(parsed.valueOf()))
      // Round-trip should produce the same string
      assert.strictEqual(parsed.toISOString(), isoString)
    })
  })
})