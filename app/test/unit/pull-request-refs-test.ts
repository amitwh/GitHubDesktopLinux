import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  extractPullRequestNumbersFromCommits,
  findPullRequestsByNumbers,
} from '../../src/lib/pull-request-refs'
import { Commit } from '../../src/models/commit'
import { CommitIdentity } from '../../src/models/commit-identity'
import { PullRequest, PullRequestRef } from '../../src/models/pull-request'
import { GitHubRepository } from '../../src/models/github-repository'
import { Owner } from '../../src/models/owner'

function makeCommit(summary: string, body: string = ''): Commit {
  const author = new CommitIdentity('A', 'a@example.com', new Date(0))
  return new Commit(
    summary.length.toString(16).padStart(40, '0'),
    summary.length.toString(16).padStart(7, '0'),
    summary,
    body,
    author,
    author,
    [],
    [],
    []
  )
}

function makePullRequest(
  num: number,
  title: string = `PR ${num}`
): PullRequest {
  const owner = new Owner('owner', 'https://example.com', 1)
  const repo = new GitHubRepository(
    'repo',
    owner,
    1,
    false,
    'https://example.com/owner/repo'
  )
  const ref = new PullRequestRef('feature', 'sha', repo)
  return new PullRequest(
    new Date(0),
    title,
    num,
    ref,
    ref,
    'someone',
    false,
    ''
  )
}

describe('extractPullRequestNumbersFromCommits', () => {
  it('returns empty for no commits', () => {
    assert.deepEqual(extractPullRequestNumbersFromCommits([]), [])
  })

  it('extracts merge-commit refs', () => {
    const commits = [makeCommit('Merge pull request #123 from a/b')]
    assert.deepEqual(extractPullRequestNumbersFromCommits(commits), [123])
  })

  it('extracts squash-merge titles', () => {
    const commits = [makeCommit('Fix the thing (#456)')]
    assert.deepEqual(extractPullRequestNumbersFromCommits(commits), [456])
  })

  it('extracts refs from the body', () => {
    const commits = [makeCommit('Refactor', 'Fixes #789 and addresses #42.')]
    assert.deepEqual(extractPullRequestNumbersFromCommits(commits), [789, 42])
  })

  it('deduplicates while preserving first-seen order', () => {
    const commits = [
      makeCommit('Title (#10)', 'Also #20 and #10'),
      makeCommit('Closes #20'),
    ]
    assert.deepEqual(extractPullRequestNumbersFromCommits(commits), [10, 20])
  })

  it('does not match # preceded by a word character', () => {
    const commits = [makeCommit('color = #ff00aa')]
    assert.deepEqual(extractPullRequestNumbersFromCommits(commits), [])
  })

  it('skips numbers larger than the cap', () => {
    const commits = [makeCommit('Bogus reference #1234567890')]
    assert.deepEqual(extractPullRequestNumbersFromCommits(commits), [])
  })

  it('returns empty when no #-prefixed numbers are present', () => {
    const commits = [makeCommit('No refs at all', 'still nothing')]
    assert.deepEqual(extractPullRequestNumbersFromCommits(commits), [])
  })
})

describe('findPullRequestsByNumbers', () => {
  it('returns empty when input numbers are empty', () => {
    assert.deepEqual(findPullRequestsByNumbers([], [makePullRequest(1)]), [])
  })

  it('returns empty when pull request list is empty', () => {
    assert.deepEqual(findPullRequestsByNumbers([1], []), [])
  })

  it('matches pull requests by number, preserving input order', () => {
    const prs = [makePullRequest(2), makePullRequest(1), makePullRequest(3)]
    const matched = findPullRequestsByNumbers([3, 1], prs)
    assert.deepEqual(
      matched.map(p => p.pullRequestNumber),
      [3, 1]
    )
  })

  it('skips numbers without a matching pull request', () => {
    const prs = [makePullRequest(1)]
    const matched = findPullRequestsByNumbers([1, 99], prs)
    assert.deepEqual(
      matched.map(p => p.pullRequestNumber),
      [1]
    )
  })
})
