import { Commit } from '../../models/commit'

export interface IMarkdownGeneratorOptions {
  readonly includeHash: boolean
  readonly includeAuthor: boolean
  readonly includeDate: boolean
  readonly includeMessage: boolean
  readonly includeStats: boolean
}

export function generateMarkdown(
  commits: ReadonlyArray<Commit>,
  repoName: string,
  options: IMarkdownGeneratorOptions
): string {
  const lines: string[] = []
  lines.push(`# Commit History: ${repoName}`)
  lines.push('')
  lines.push(`*Generated on ${new Date().toISOString()}*`)
  lines.push('')
  lines.push(`Total commits: ${commits.length}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const commit of commits) {
    const parts: string[] = []

    if (options.includeHash) {
      parts.push(`**${commit.shortSha}**`)
    }

    if (options.includeDate) {
      parts.push(commit.author.date.toISOString())
    }

    if (options.includeAuthor) {
      parts.push(`*${commit.author.name}*`)
    }

    if (parts.length > 0) {
      lines.push(parts.join(' · '))
    }

    if (options.includeMessage) {
      lines.push('')
      lines.push(commit.summary)
      if (commit.body.length > 0) {
        lines.push('')
        lines.push(commit.body)
      }
    }

    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}
