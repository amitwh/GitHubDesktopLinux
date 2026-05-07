import { Commit } from '../models/commit'
import { PullRequest } from '../models/pull-request'

/**
 * Extract pull request numbers referenced in a list of commits by scanning
 * commit summaries and bodies for `#NNNN` patterns.
 *
 * Catches the common cases:
 *   - GitHub merge commits: `Merge pull request #123 from owner/branch`
 *   - Squash-merged titles:  `Some title (#456)`
 *   - Free-text references:  `Fixes #789`
 *
 * Numbers are returned in first-seen order with duplicates removed.
 */
export function extractPullRequestNumbersFromCommits(
  commits: ReadonlyArray<Commit>
): ReadonlyArray<number> {
  const seen = new Set<number>()
  const result: Array<number> = []

  // `#NNNN` preceded by a non-word character (or start) so we don't match
  // tokens like `abc#123`. We accept up to 9 digits to keep numbers sane.
  const refPattern = /(?:^|[^\w])#(\d{1,9})\b/g

  for (const commit of commits) {
    const fields = [commit.summary, commit.body]
    for (const field of fields) {
      if (!field) {
        continue
      }
      refPattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = refPattern.exec(field)) !== null) {
        const prNumber = parseInt(match[1], 10)
        if (
          Number.isFinite(prNumber) &&
          prNumber > 0 &&
          prNumber <= 999_999_999 &&
          !seen.has(prNumber)
        ) {
          seen.add(prNumber)
          result.push(prNumber)
        }
      }
    }
  }

  return result
}

/**
 * Find pull requests in a locally-cached list whose numbers appear in the
 * given list. Preserves the order of `numbers` (first-seen wins) and skips
 * numbers without a matching PR — letting callers fall back gracefully.
 */
export function findPullRequestsByNumbers(
  numbers: ReadonlyArray<number>,
  pullRequests: ReadonlyArray<PullRequest>
): ReadonlyArray<PullRequest> {
  if (numbers.length === 0 || pullRequests.length === 0) {
    return []
  }

  const byNumber = new Map<number, PullRequest>()
  for (const pr of pullRequests) {
    byNumber.set(pr.pullRequestNumber, pr)
  }

  const result: Array<PullRequest> = []
  for (const prNumber of numbers) {
    const match = byNumber.get(prNumber)
    if (match !== undefined) {
      result.push(match)
    }
  }
  return result
}
