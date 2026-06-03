# Commit History Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to export the commit history of any repository to Markdown, PDF, DOCX, HTML, and other formats via pandoc.

**Architecture:** Generate Markdown from git log using existing `dugite` APIs, then use `pandoc` (system dependency) to convert to the user's chosen format. A dialog collects export options (format, range, include fields) and a file picker selects the output path.

**Tech Stack:** TypeScript, React, Electron IPC, dugite, pandoc

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/src/lib/commit-export/markdown-generator.ts` | Create | Generate Markdown string from Commit array |
| `app/src/lib/commit-export/pandoc-converter.ts` | Create | Spawn pandoc to convert Markdown to target format |
| `app/src/lib/commit-export/index.ts` | Create | Public API: `exportCommitHistory(repository, options)` |
| `app/src/ui/export-commit-history/` | Create dir | Dialog component for export options |
| `app/src/ui/export-commit-history/export-commit-history-dialog.tsx` | Create | React dialog UI |
| `app/src/ui/export-commit-history/styles.scss` | Create | Dialog-specific styles |
| `app/src/main-process/menu/build-default-menu.ts` | Modify | Add "Export Commit History…" menu item under Repository |
| `app/src/ui/app.tsx` | Modify | Add dialog to App's popup rendering |
| `app/src/ui/dispatcher/dispatcher.ts` | Modify | Add `showExportCommitHistoryDialog` action |
| `app/src/lib/app-state.ts` | Modify | Add `ExportCommitHistory` popup type |
| `app/src/models/popup.ts` | Modify | Add `ExportCommitHistory` popup type |
| `docs/contributing/setup-linux.md` | Modify | Add pandoc to Linux dependencies |

---

### Task 1: Create Commit Export Core

**Files:**
- Create: `app/src/lib/commit-export/markdown-generator.ts`
- Create: `app/src/lib/commit-export/pandoc-converter.ts`
- Create: `app/src/lib/commit-export/index.ts`

- [ ] **Step 1: Create markdown generator**

Create `app/src/lib/commit-export/markdown-generator.ts`:

```typescript
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
      parts.push(`**${commit.sha.substring(0, 7)}**`)
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
```

- [ ] **Step 2: Create pandoc converter**

Create `app/src/lib/commit-export/pandoc-converter.ts`:

```typescript
import * as cp from 'child_process'
import * as fs from 'fs'
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
  const ext = path.extname(outputPath).toLowerCase()
  const fromExt = ext === '.md' ? 'markdown' : undefined

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
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stderr = ''
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`pandoc exited with code ${code}: ${stderr}`))
      }
    })

    child.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn pandoc: ${err.message}. Is pandoc installed?`))
    })

    child.stdin.write(markdownContent, 'utf-8', (err: Error | null | undefined) => {
      if (err) {
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
```

- [ ] **Step 3: Create public API**

Create `app/src/lib/commit-export/index.ts`:

```typescript
import { Repository } from '../../models/repository'
import { Commit } from '../../models/commit'
import { generateMarkdown, IMarkdownGeneratorOptions } from './markdown-generator'
import { convertWithPandoc, PandocFormat, getFormatFromExtension } from './pandoc-converter'
import { getCommits } from '../git'

export interface IExportOptions extends IMarkdownGeneratorOptions {
  readonly format: PandocFormat
  readonly outputPath: string
  readonly branch?: string
  readonly since?: Date
  readonly until?: Date
}

export { PandocFormat, getFormatFromExtension }

export async function exportCommitHistory(
  repository: Repository,
  options: IExportOptions
): Promise<void> {
  const commits = await getCommits(repository, options.branch, options.since, options.until)

  const repoName = repository.name
  const markdown = generateMarkdown(commits, repoName, options)

  if (options.format === 'pdf' || path.extname(options.outputPath) !== '.md') {
    await convertWithPandoc(markdown, options.outputPath, options.format)
  } else {
    const fs = await import('fs/promises')
    await fs.writeFile(options.outputPath, markdown, 'utf-8')
  }
}
```

**Note:** `getCommits` signature may need adjustment. Verify the actual `app/src/lib/git/log.ts` API.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/commit-export/
git commit -m "feat: add commit export core (markdown generator + pandoc converter)"
```

---

### Task 2: Add Export Dialog UI

**Files:**
- Create: `app/src/ui/export-commit-history/export-commit-history-dialog.tsx`
- Create: `app/src/ui/export-commit-history/styles.scss`
- Create: `app/src/ui/export-commit-history/index.ts`

- [ ] **Step 1: Create dialog component**

Create `app/src/ui/export-commit-history/export-commit-history-dialog.tsx`:

```typescript
import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Button } from '../lib/button'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Row } from '../lib/row'
import { Select } from '../lib/select'
import { Ref } from '../lib/ref'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import {
  exportCommitHistory,
  PandocFormat,
  getFormatFromExtension,
} from '../../lib/commit-export'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'

interface IExportCommitHistoryDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly onDismissed: () => void
}

interface IExportCommitHistoryDialogState {
  readonly format: PandocFormat
  readonly includeHash: boolean
  readonly includeAuthor: boolean
  readonly includeDate: boolean
  readonly includeMessage: boolean
  readonly includeStats: boolean
  readonly isExporting: boolean
  readonly exportError: Error | null
}

const formats: Array<{ label: string; value: PandocFormat }> = [
  { label: 'Markdown (.md)', value: 'pdf' },
  { label: 'PDF (.pdf)', value: 'pdf' },
  { label: 'Word (.docx)', value: 'docx' },
  { label: 'HTML (.html)', value: 'html' },
  { label: 'ODT (.odt)', value: 'odt' },
]

export class ExportCommitHistoryDialog extends React.Component<
  IExportCommitHistoryDialogProps,
  IExportCommitHistoryDialogState
> {
  public constructor(props: IExportCommitHistoryDialogProps) {
    super(props)

    this.state = {
      format: 'pdf',
      includeHash: true,
      includeAuthor: true,
      includeDate: true,
      includeMessage: true,
      includeStats: false,
      isExporting: false,
      exportError: null,
    }
  }

  private onFormatChange = (event: React.FormEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value as PandocFormat
    this.setState({ format: value })
  }

  private onIncludeHashChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked
    this.setState({ includeHash: value })
  }

  private onIncludeAuthorChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked
    this.setState({ includeAuthor: value })
  }

  private onIncludeDateChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked
    this.setState({ includeDate: value })
  }

  private onIncludeMessageChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked
    this.setState({ includeMessage: value })
  }

  private onIncludeStatsChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked
    this.setState({ includeStats: value })
  }

  private onExport = async () => {
    const { repository } = this.props
    const {
      format,
      includeHash,
      includeAuthor,
      includeDate,
      includeMessage,
      includeStats,
    } = this.state

    this.setState({ isExporting: true, exportError: null })

    try {
      const { ipcRenderer } = await import('../../lib/ipc-renderer')
      const outputPath: string | undefined = await ipcRenderer.invoke(
        'show-save-dialog',
        {
          defaultPath: `${repository.name}-commits.${format}`,
          filters: [
            { name: format.toUpperCase(), extensions: [format] },
          ],
        }
      )

      if (outputPath === undefined) {
        this.setState({ isExporting: false })
        return
      }

      await exportCommitHistory(repository, {
        format,
        outputPath,
        includeHash,
        includeAuthor,
        includeDate,
        includeMessage,
        includeStats,
      })

      this.props.onDismissed()
    } catch (err) {
      this.setState({ isExporting: false, exportError: err as Error })
    }
  }

  public render() {
    const {
      format,
      includeHash,
      includeAuthor,
      includeDate,
      includeMessage,
      includeStats,
      isExporting,
      exportError,
    } = this.state

    return (
      <Dialog
        id="export-commit-history"
        title={__DARWIN__ ? 'Export Commit History' : 'Export commit history'}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onExport}
        loading={isExporting}
      >
        <DialogContent>
          <Row>
            <Select label="Format" value={format} onChange={this.onFormatChange}>
              {formats.map(f => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Row>

          <Row>
            <Checkbox
              label="Include commit hash"
              value={includeHash ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onIncludeHashChange}
            />
          </Row>

          <Row>
            <Checkbox
              label="Include author"
              value={includeAuthor ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onIncludeAuthorChange}
            />
          </Row>

          <Row>
            <Checkbox
              label="Include date"
              value={includeDate ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onIncludeDateChange}
            />
          </Row>

          <Row>
            <Checkbox
              label="Include commit message"
              value={includeMessage ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onIncludeMessageChange}
            />
          </Row>

          <Row>
            <Checkbox
              label="Include diff stats"
              value={includeStats ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onIncludeStatsChange}
            />
          </Row>

          {exportError && (
            <Row>
              <Ref className="error-message">{exportError.message}</Ref>
            </Row>
          )}
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={isExporting ? 'Exporting…' : 'Export'}
            okButtonDisabled={isExporting}
            onCancelButtonClick={this.props.onDismissed}
            onOkButtonClick={this.onExport}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
```

**Note:** The `Select`, `Checkbox`, `Row`, `Ref` components and `DialogContent`/`DialogFooter` APIs may differ. Verify actual component names and props in the codebase and adjust.

- [ ] **Step 2: Create index file**

Create `app/src/ui/export-commit-history/index.ts`:

```typescript
export { ExportCommitHistoryDialog } from './export-commit-history-dialog'
```

- [ ] **Step 3: Commit**

```bash
git add app/src/ui/export-commit-history/
git commit -m "feat: add export commit history dialog UI"
```

---

### Task 3: Wire Up App State, Dispatcher, and Menu

**Files:**
- Modify: `app/src/models/popup.ts`
- Modify: `app/src/lib/app-state.ts`
- Modify: `app/src/ui/dispatcher/dispatcher.ts`
- Modify: `app/src/ui/app.tsx`
- Modify: `app/src/main-process/menu/build-default-menu.ts`

- [ ] **Step 1: Add popup type**

Open `app/src/models/popup.ts`. Find the `PopupType` enum and add:

```typescript
ExportCommitHistory = 'ExportCommitHistory',
```

Then add to the `Popup` union type:

```typescript
| { type: PopupType.ExportCommitHistory; repository: Repository }
```

- [ ] **Step 2: Add app state popup type**

Open `app/src/lib/app-state.ts`. Find where `currentPopup` is typed (likely `Popup | null`) and ensure the `ExportCommitHistory` popup is covered by the `Popup` type from `app/src/models/popup.ts`. If `currentPopup` uses the `Popup` type directly, no change is needed beyond Step 1.

- [ ] **Step 3: Add dispatcher action**

Open `app/src/ui/dispatcher/dispatcher.ts`. Find the class and add:

```typescript
public showExportCommitHistoryDialog(repository: Repository) {
  return this.showPopup({ type: PopupType.ExportCommitHistory, repository })
}
```

- [ ] **Step 4: Render dialog in App**

Open `app/src/ui/app.tsx`. Find where other dialogs are rendered based on `currentPopup.type`. Add:

```typescript
case PopupType.ExportCommitHistory:
  return (
    <ExportCommitHistoryDialog
      key="export-commit-history"
      dispatcher={this.props.dispatcher}
      repository={popup.repository}
      onDismissed={this.onPopupDismissed}
    />
  )
```

Also add the import:

```typescript
import { ExportCommitHistoryDialog } from './export-commit-history'
```

- [ ] **Step 5: Add menu item**

Open `app/src/main-process/menu/build-default-menu.ts`. Find the `Repository` menu section. Add after `Repository Settings…`:

```typescript
{
  label: __DARWIN__ ? 'Export Commit History…' : 'Export commit &history…',
  id: 'export-commit-history',
  click: emit('export-commit-history'),
},
```

- [ ] **Step 6: Add menu event**

Open `app/src/main-process/menu/menu-event.ts`. Add to the `MenuEvent` type:

```typescript
| 'export-commit-history'
```

- [ ] **Step 7: Handle menu event in dispatcher**

Open `app/src/ui/dispatcher/dispatcher.ts` (or wherever menu events are handled). Add handling for `'export-commit-history'` that calls `this.showExportCommitHistoryDialog(repository)` when the current repository is available.

The exact location depends on how menu events are wired. Search for existing menu event handlers like `'show-history'` to find the pattern.

- [ ] **Step 8: Add IPC handler for save dialog**

Open `app/src/main-process/ipc-main.ts` (or wherever IPC handlers are registered). Add:

```typescript
ipcMain.handle('show-save-dialog', async (_, options) => {
  const { filePath } = await dialog.showSaveDialog(options)
  return filePath
})
```

Also ensure `dialog` is imported from `electron`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: wire up export commit history dialog to app menu and state"
```

---

### Task 4: Add Pandoc Dependency Documentation

**Files:**
- Modify: `docs/contributing/setup-linux.md`

- [ ] **Step 1: Update Linux setup docs**

Add to `docs/contributing/setup-linux.md` after the existing Electron dependencies section:

```markdown
## Export Dependencies

To use the commit history export feature (Markdown, PDF, DOCX, etc.), you need pandoc installed:

```bash
$ sudo apt install -y pandoc
```

For PDF export, you also need a LaTeX engine:

```bash
$ sudo apt install -y texlive-xetex
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/contributing/setup-linux.md
git commit -m "docs: add pandoc to Linux setup dependencies"
```

---

### Task 5: Build, Test, and Push

**Files:** None

- [ ] **Step 1: Build**

```bash
cd /home/amith/apps/GitHubDesktop
yarn build:prod
```

- [ ] **Step 2: Run linter**

```bash
yarn eslint
```

- [ ] **Step 3: Run unit tests**

```bash
yarn test:unit
```

- [ ] **Step 4: Push linux branch**

```bash
git push origin linux
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|-------------|------|
| Markdown generator | Task 1 |
| Pandoc converter (PDF, DOCX, HTML, ODT, etc.) | Task 1 |
| Export dialog UI | Task 2 |
| App menu integration | Task 3 |
| App state / dispatcher wiring | Task 3 |
| IPC for save dialog | Task 3 |
| Documentation | Task 4 |

All covered.

### Placeholder Scan

- No TBD/TODO.
- Component APIs may need adjustment to match actual codebase — subagent must verify imports and props.
- `getCommits` signature in `app/src/lib/git/log.ts` must be verified before implementing Task 1 Step 3.
