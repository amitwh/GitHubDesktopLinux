import { promises as fs } from 'fs'
import { Repository } from '../../models/repository'
import { Commit } from '../../models/commit'
export { Commit }
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

  if (options.format === 'markdown') {
    await fs.writeFile(options.outputPath, markdown, 'utf-8')
  } else {
    await convertWithPandoc(markdown, options.outputPath, options.format)
  }
}
