import { Repository } from '../../models/repository'
import { Commit } from '../../models/commit'
import { generateMarkdown, IMarkdownGeneratorOptions } from './markdown-generator'
import { convertWithPandoc, PandocFormat, getFormatFromExtension } from './pandoc-converter'
import { getCommits } from '../git/log'

export interface IExportOptions extends IMarkdownGeneratorOptions {
  readonly format: PandocFormat
  readonly outputPath: string
  readonly branch?: string
}

export { PandocFormat, getFormatFromExtension }

export async function exportCommitHistory(
  repository: Repository,
  options: IExportOptions
): Promise<void> {
  const revisionRange = options.branch
  const commits = await getCommits(repository, revisionRange)

  const repoName = repository.name
  const markdown = generateMarkdown(commits, repoName, options)

  if (options.format === 'pdf' || options.outputPath.endsWith('.md') === false) {
    await convertWithPandoc(markdown, options.outputPath, options.format)
  } else {
    const fs = await import('fs/promises')
    await fs.writeFile(options.outputPath, markdown, 'utf-8')
  }
}
