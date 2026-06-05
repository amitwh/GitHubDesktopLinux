import * as cp from 'child_process'
import * as path from 'path'

export type PandocFormat =
  | 'markdown'
  | 'pdf'
  | 'docx'
  | 'odt'
  | 'html'
  | 'epub'
  | 'tex'
  | 'rtf'

/**
 * Ordered list of preferred PDF engines. LaTeX engines (xelatex, pdflatex,
 * lualatex) produce higher-fidelity PDFs but require large TeX Live installs.
 * HTML→PDF engines (wkhtmltopdf, weasyprint) are smaller and produce simpler
 * output. The first available engine wins.
 */
const PDF_ENGINES = [
  'xelatex',
  'pdflatex',
  'lualatex',
  'wkhtmltopdf',
  'weasyprint',
] as const

let cachedPdfEngine: string | null = null
let cachedPdfEngineChecked = false

function isCommandAvailable(cmd: string): Promise<boolean> {
  return new Promise(resolve => {
    const probe = cp.spawn('which', [cmd], { stdio: 'ignore' })
    probe.on('close', code => resolve(code === 0))
    probe.on('error', () => resolve(false))
  })
}

async function detectPdfEngine(): Promise<string> {
  if (cachedPdfEngineChecked) {
    if (cachedPdfEngine !== null) {
      return cachedPdfEngine
    }
    throw new Error(
      `No PDF engine found. Tried: ${PDF_ENGINES.join(', ')}.\n` +
        `On Debian/Ubuntu, install one of:\n` +
        `  sudo apt install texlive-xetex      # xelatex (~500MB, Unicode-friendly)\n` +
        `  sudo apt install texlive-latex-base # pdflatex (~150MB)\n` +
        `  sudo apt install wkhtmltopdf        # HTML→PDF (~50MB)\n` +
        `  pip install weasyprint              # Python HTML→PDF`
    )
  }
  for (const engine of PDF_ENGINES) {
    if (await isCommandAvailable(engine)) {
      cachedPdfEngine = engine
      cachedPdfEngineChecked = true
      return engine
    }
  }
  cachedPdfEngineChecked = true
  cachedPdfEngine = null
  // Re-throw with installation guidance
  throw new Error(
    `No PDF engine found. Tried: ${PDF_ENGINES.join(', ')}.\n` +
      `On Debian/Ubuntu, install one of:\n` +
      `  sudo apt install texlive-xetex      # xelatex (~500MB, Unicode-friendly)\n` +
      `  sudo apt install texlive-latex-base # pdflatex (~150MB)\n` +
      `  sudo apt install wkhtmltopdf        # HTML→PDF (~50MB)\n` +
      `  pip install weasyprint              # Python HTML→PDF`
  )
}

export async function convertWithPandoc(
  markdownContent: string,
  outputPath: string,
  format: PandocFormat
): Promise<void> {
  const args: string[] = [
    '-f', 'markdown',
    '-t', format,
    '-o', outputPath,
    '--resource-path', path.dirname(outputPath),
  ]

  if (format === 'pdf') {
    const engine = await detectPdfEngine()
    args.push(`--pdf-engine=${engine}`)
  }

  return new Promise((resolve, reject) => {
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
