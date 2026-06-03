import { git } from './core'
import { Repository } from '../../models/repository'

export interface IBlameHunk {
  readonly startLine: number
  readonly lineCount: number
  readonly sha: string
  readonly author: string
  readonly authorEmail: string
  readonly timestamp: Date
  readonly summary: string
}

export async function getBlame(
  repository: Repository,
  relativePath: string
): Promise<ReadonlyArray<IBlameHunk>> {
  const result = await git(
    ['blame', '--porcelain', relativePath],
    repository.path,
    'getBlame',
    { successExitCodes: new Set([0, 128]) }
  )

  if (result.exitCode === 128) {
    return []
  }

  const lines = result.stdout.split('\n')
  const hunks: IBlameHunk[] = []

  let currentSha = ''
  let currentAuthor = ''
  let currentEmail = ''
  let currentTime = 0
  let currentSummary = ''
  let startLine = 0
  let lineCount = 0

  for (const line of lines) {
    if (line.startsWith('header ') || line === '') {
      continue
    }

    if (line.startsWith('author ')) {
      currentAuthor = line.substring(7)
    } else if (line.startsWith('author-mail ')) {
      currentEmail = line.substring(12).replace(/[<>]/g, '')
    } else if (line.startsWith('author-time ')) {
      currentTime = parseInt(line.substring(12), 10)
    } else if (line.startsWith('summary ')) {
      currentSummary = line.substring(8)
    } else if (/^[0-9a-f]{40} /.test(line)) {
      if (currentSha !== '' && currentSha !== line.substring(0, 40)) {
        hunks.push({
          startLine,
          lineCount,
          sha: currentSha,
          author: currentAuthor,
          authorEmail: currentEmail,
          timestamp: new Date(currentTime * 1000),
          summary: currentSummary,
        })
        startLine += lineCount
        lineCount = 0
      }
      currentSha = line.substring(0, 40)
      lineCount++
    }
  }

  if (currentSha !== '') {
    hunks.push({
      startLine,
      lineCount,
      sha: currentSha,
      author: currentAuthor,
      authorEmail: currentEmail,
      timestamp: new Date(currentTime * 1000),
      summary: currentSummary,
    })
  }

  return hunks
}
