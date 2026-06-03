import * as cp from 'child_process'
import * as path from 'path'

export type PandocFormat =
  | 'pdf'
  | 'docx'
  | 'odt'
  | 'html'
  | 'epub'
  | 'tex'
  | 'rtf'

export async function convertWithPandoc(
  markdownContent: string,
  outputPath: string,
  format: PandocFormat
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-f', 'markdown',
      '-t', format,
      '-o', outputPath,
      '--resource-path', path.dirname(outputPath),
    ]

    if (format === 'pdf') {
      args.push('--pdf-engine=xelatex')
    }

    const child = cp.spawn('pandoc', args, {
      stdio: ['pipe', 'ignore', 'pipe'],
    })

    let stderr = ''
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('pandoc timed out after 30 seconds'))
    }, 30000)

    child.on('close', (code: number | null) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`pandoc exited with code ${code}: ${stderr}`))
      }
    })

    child.on('error', (err: Error) => {
      clearTimeout(timeout)
      reject(new Error(`Failed to spawn pandoc: ${err.message}. Is pandoc installed?`))
    })

    child.stdin.write(markdownContent, 'utf-8', (err: Error | null | undefined) => {
      if (err) {
        clearTimeout(timeout)
        reject(new Error(`Failed to write to pandoc stdin: ${err.message}`))
        return
      }
      child.stdin.end()
    })
  })
}

export function getFormatFromExtension(ext: string): PandocFormat | undefined {
  const map: Record<string, PandocFormat> = {
    '.pdf': 'pdf',
    '.docx': 'docx',
    '.odt': 'odt',
    '.html': 'html',
    '.epub': 'epub',
    '.tex': 'tex',
    '.rtf': 'rtf',
  }
  return map[ext.toLowerCase()]
}
