# Meld-Style Diff Viewer — Phase 1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1a of the Meld-style diff viewer: a standalone BrowserWindow that opens from context menu, displays a file tree + read-only diff, and can launch configured external diff tools (Meld, KDiff3, Beyond Compare, VS Code, vimdiff) with substituted args.

**Architecture:** New `app/src/ui/meld/` module renders the Meld window React tree. Main-process `app/src/main-process/meld/meld-window.ts` creates a separate Electron BrowserWindow and owns its lifecycle. IPC `meld:*` channels pass commands between renderer and main. Reuses existing diff primitives (`app/src/ui/diff/side-by-side-diff-row.tsx`) by composition. State lives in `app-state` store with a new `meldSessions` slice.

**Tech Stack:** Electron BrowserWindow, React 16.8+, TypeScript strict, xdg-mime (system-level protocol/scheme registration already done in prior commits), Jest + React Testing Library for unit tests, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-06-05-meld-style-diff-viewer-design.md`

---

## File Structure

### New Files

| Path | LOC est. | Responsibility |
|------|---------|----------------|
| `app/src/models/external-tool.ts` | 30 | `IExternalTool` type definition |
| `app/src/lib/meld/external-tool-args.ts` | 80 | Arg-template substitution (`%L`, `%R`, `%B`) |
| `app/src/lib/meld/default-tools.ts` | 80 | Pre-populated tool list (5 tools) |
| `app/src/lib/meld/index.ts` | 20 | Public exports for `app/src/lib/meld/` |
| `app/src/ui/meld/MeldWindow.tsx` | 200 | Root Meld window component |
| `app/src/ui/meld/MeldToolbar.tsx` | 150 | Filter, mode toggle, external tool dropdown |
| `app/src/ui/meld/MeldFileTree.tsx` | 250 | File tree sidebar |
| `app/src/ui/meld/MeldDiffPane.tsx` | 250 | Read-only side-by-side diff |
| `app/src/ui/meld/index.ts` | 30 | Public exports for `app/src/ui/meld/` |
| `app/src/ui/meld/settings/ExternalToolsSettings.tsx` | 200 | Settings UI to add/edit/remove tools |
| `app/src/main-process/meld/meld-window.ts` | 130 | BrowserWindow lifecycle |
| `app/src/main-process/meld/meld-ipc.ts` | 100 | IPC handlers |
| `app/src/main-process/meld/menu-integration.ts` | 70 | Context menu items |
| `app/src/main-process/meld/index.ts` | 20 | Public exports |
| `app/test/unit/meld/external-tool-args-test.ts` | 100 | Tests for arg substitution |
| `app/test/unit/meld/default-tools-test.ts` | 60 | Tests for default tools list |
| `app/test/unit/ui/meld/MeldWindow-test.tsx` | 80 | MeldWindow component smoke test |
| `app/test/unit/ui/meld/MeldToolbar-test.tsx` | 60 | Toolbar interaction tests |
| `app/test/unit/ui/meld/MeldFileTree-test.tsx` | 60 | File tree tests |
| `app/test/e2e/meld/meld-basic-flow-test.ts` | 120 | E2E: open Meld window, view diff |

### Modified Files

| Path | Changes |
|------|---------|
| `app/src/lib/app-state.ts` | Add `meldSessions: IMeldSession[]` and `externalTools: IExternalTool[]` slices |
| `app/src/ui/dispatcher/dispatcher.ts` | Add `openInMeldWindow`, `closeMeldWindow`, `listExternalTools`, `configureExternalTool`, `removeExternalTool`, `launchExternalTool` actions |
| `app/src/main-process/main.ts` | Initialize `meld-ipc.ts` on app ready, register the `meld:open-window` handler at startup |
| `app/src/main-process/menu/build-default-menu.ts` | No menu additions in 1a (context menu only); 1a uses context menu via `menu-integration.ts` |
| `app/src/ui/index.tsx` | No changes (Meld window has its own React root) |

---

## Task 1: Define IExternalTool model

**Files:**
- Create: `app/src/models/external-tool.ts`

- [ ] **Step 1: Create the model file**

```typescript
// app/src/models/external-tool.ts
export interface IExternalTool {
  readonly id: string
  readonly name: string
  readonly command: string                  // Absolute path or command in PATH
  readonly args: string                     // Template with %L %R %B placeholders
  readonly builtIn: boolean                  // True for default tools (cannot be deleted, can be overridden)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `yarn build:prod 2>&1 | tail -5`
Expected: Build succeeds (the new file is empty of consumers yet, but the type compiles)

- [ ] **Step 3: Commit**

```bash
git add app/src/models/external-tool.ts
git commit -m "feat(meld): add IExternalTool model"
```

---

## Task 2: Add external-tool-args substitution library (TDD)

**Files:**
- Create: `app/src/lib/meld/external-tool-args.ts`
- Test: `app/test/unit/meld/external-tool-args-test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/test/unit/meld/external-tool-args-test.ts
import { substituteArgs } from '../../../src/lib/meld/external-tool-args'
import { IExternalTool } from '../../../src/models/external-tool'

describe('external-tool-args/substituteArgs', () => {
  const tool: IExternalTool = {
    id: 'meld',
    name: 'Meld',
    command: 'meld',
    args: '%L %R',
    builtIn: true,
  }

  it('substitutes %L with the left path', () => {
    const result = substituteArgs(tool, {
      leftPath: '/tmp/a.txt',
      rightPath: '/tmp/b.txt',
    })
    expect(result).toEqual(['meld', '/tmp/a.txt', '/tmp/b.txt'])
  })

  it('substitutes %R with the right path', () => {
    const result = substituteArgs(tool, {
      leftPath: '/tmp/a.txt',
      rightPath: '/tmp/b.txt',
    })
    expect(result[2]).toEqual('/tmp/b.txt')
  })

  it('substitutes %B with the base path when provided', () => {
    const threeWayTool: IExternalTool = { ...tool, args: '%B %L %R' }
    const result = substituteArgs(threeWayTool, {
      leftPath: '/tmp/a.txt',
      rightPath: '/tmp/b.txt',
      basePath: '/tmp/base.txt',
    })
    expect(result).toEqual(['meld', '/tmp/base.txt', '/tmp/a.txt', '/tmp/b.txt'])
  })

  it('throws when %B is requested but basePath is not provided', () => {
    const threeWayTool: IExternalTool = { ...tool, args: '%B %L %R' }
    expect(() => substituteArgs(threeWayTool, {
      leftPath: '/tmp/a.txt',
      rightPath: '/tmp/b.txt',
    })).toThrow(/basePath is required/)
  })

  it('substitutes paths with spaces correctly without quoting (caller quotes)', () => {
    const result = substituteArgs(tool, {
      leftPath: '/tmp/with space/a.txt',
      rightPath: '/tmp/with space/b.txt',
    })
    expect(result).toEqual(['meld', '/tmp/with space/a.txt', '/tmp/with space/b.txt'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:unit --testPathPattern=external-tool-args-test 2>&1 | tail -10`
Expected: FAIL with "Cannot find module '../../../src/lib/meld/external-tool-args'"

- [ ] **Step 3: Write the minimal implementation**

```typescript
// app/src/lib/meld/external-tool-args.ts
import { IExternalTool } from '../../models/external-tool'

export interface ISubstituteArgsInput {
  readonly leftPath: string
  readonly rightPath: string
  readonly basePath?: string
}

export function substituteArgs(
  tool: IExternalTool,
  input: ISubstituteArgsInput
): ReadonlyArray<string> {
  const tokens = tokenize(tool.args)
  const result: string[] = [tool.command]

  for (const token of tokens) {
    if (token === '%L') {
      result.push(input.leftPath)
    } else if (token === '%R') {
      result.push(input.rightPath)
    } else if (token === '%B') {
      if (input.basePath === undefined) {
        throw new Error(
          `Tool "${tool.name}" requires a base path (%B) but none was provided.`
        )
      }
      result.push(input.basePath)
    } else {
      result.push(token)
    }
  }

  return result
}

function tokenize(args: string): string[] {
  // Simple whitespace split. If we need quoted-arg support later, swap
  // for a proper shell-quote tokenizer. For now all default tools use
  // simple "%L %R" patterns.
  return args.split(/\s+/).filter(t => t.length > 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:unit --testPathPattern=external-tool-args-test 2>&1 | tail -10`
Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/meld/external-tool-args.ts app/test/unit/meld/external-tool-args-test.ts
git commit -m "feat(meld): add arg-template substitution for external tools"
```

---

## Task 3: Add default tools list (TDD)

**Files:**
- Create: `app/src/lib/meld/default-tools.ts`
- Test: `app/test/unit/meld/default-tools-test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/test/unit/meld/default-tools-test.ts
import { getDefaultExternalTools } from '../../../src/lib/meld/default-tools'

describe('default-tools/getDefaultExternalTools', () => {
  it('returns exactly 5 default tools', () => {
    expect(getDefaultExternalTools().length).toEqual(5)
  })

  it('includes Meld with %L %R args', () => {
    const meld = getDefaultExternalTools().find(t => t.name === 'Meld')
    expect(meld).toBeDefined()
    expect(meld!.command).toEqual('meld')
    expect(meld!.args).toEqual('%L %R')
    expect(meld!.builtIn).toEqual(true)
  })

  it('includes KDiff3 with %L %R args', () => {
    const kdiff3 = getDefaultExternalTools().find(t => t.name === 'KDiff3')
    expect(kdiff3).toBeDefined()
    expect(kdiff3!.args).toEqual('%L %R')
  })

  it('includes VS Code with --diff %L %R args', () => {
    const code = getDefaultExternalTools().find(t => t.name === 'VS Code')
    expect(code).toBeDefined()
    expect(code!.args).toEqual('--diff %L %R')
  })

  it('marks all default tools as builtIn', () => {
    for (const tool of getDefaultExternalTools()) {
      expect(tool.builtIn).toEqual(true)
    }
  })

  it('gives each tool a unique id', () => {
    const ids = getDefaultExternalTools().map(t => t.id)
    const unique = new Set(ids)
    expect(unique.size).toEqual(ids.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:unit --testPathPattern=default-tools-test 2>&1 | tail -10`
Expected: FAIL with "Cannot find module '../../../src/lib/meld/default-tools'"

- [ ] **Step 3: Write the minimal implementation**

```typescript
// app/src/lib/meld/default-tools.ts
import { IExternalTool } from '../../models/external-tool'

export function getDefaultExternalTools(): ReadonlyArray<IExternalTool> {
  return [
    { id: 'meld', name: 'Meld', command: 'meld', args: '%L %R', builtIn: true },
    { id: 'kdiff3', name: 'KDiff3', command: 'kdiff3', args: '%L %R', builtIn: true },
    { id: 'bcompare', name: 'Beyond Compare', command: 'bcompare', args: '%L %R', builtIn: true },
    { id: 'code', name: 'VS Code', command: 'code', args: '--diff %L %R', builtIn: true },
    { id: 'vimdiff', name: 'vimdiff', command: 'vimdiff', args: '%L %R', builtIn: true },
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:unit --testPathPattern=default-tools-test 2>&1 | tail -10`
Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/meld/default-tools.ts app/test/unit/meld/default-tools-test.ts
git commit -m "feat(meld): add default external tools list (Meld, KDiff3, BC, VSCode, vimdiff)"
```

---

## Task 4: Add `app/src/lib/meld/index.ts` public exports

**Files:**
- Create: `app/src/lib/meld/index.ts`

- [ ] **Step 1: Create the barrel file**

```typescript
// app/src/lib/meld/index.ts
export { substituteArgs, ISubstituteArgsInput } from './external-tool-args'
export { getDefaultExternalTools } from './default-tools'
```

- [ ] **Step 2: Verify build still works**

Run: `yarn build:prod 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/meld/index.ts
git commit -m "feat(meld): add lib/meld index barrel"
```

---

## Task 5: Extend `app-state` with Meld slices

**Files:**
- Modify: `app/src/lib/app-state.ts`

- [ ] **Step 1: Add the new types and state slices**

Open `app/src/lib/app-state.ts`. Find the existing `IAppState` interface and add these types + fields. Use `git grep -n "interface IAppState"` to find the right location if needed.

Add the imports at the top of the file:

```typescript
import { IExternalTool } from '../models/external-tool'
```

Add the new types near the existing types in the file:

```typescript
export interface IMeldSession {
  readonly id: string
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: 'working' | 'commit' | 'merge'
  readonly baseRef?: string
}
```

Add the new fields to the `IAppState` interface:

```typescript
  readonly meldSessions: ReadonlyArray<IMeldSession>
  readonly externalTools: ReadonlyArray<IExternalTool>
```

- [ ] **Step 2: Find the default state initializer**

Run: `git grep -n "showWelcomeFlow\|initialState\|getInitialAppState" app/src/lib/app-state.ts`
Look for where the default state object is constructed. Add the new fields with default values:

```typescript
    meldSessions: [],
    externalTools: getDefaultExternalTools(),
```

(You'll need to add `import { getDefaultExternalTools } from './meld'` at the top of `app-state.ts`.)

- [ ] **Step 3: Verify build still works**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds (no consumers yet, but the type compiles)

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/app-state.ts
git commit -m "feat(meld): add meldSessions and externalTools state slices"
```

---

## Task 6: Add main-process Meld IPC handlers

**Files:**
- Create: `app/src/main-process/meld/meld-ipc.ts`
- Create: `app/src/main-process/meld/index.ts`

- [ ] **Step 1: Create the IPC module**

```typescript
// app/src/main-process/meld/meld-ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { getDefaultExternalTools } from '../../lib/meld/default-tools'
import { substituteArgs, ISubstituteArgsInput } from '../../lib/meld/external-tool-args'
import { IExternalTool } from '../../models/external-tool'

interface ILaunchToolRequest {
  readonly tool: IExternalTool
  readonly leftPath: string
  readonly rightPath: string
  readonly basePath?: string
}

export function registerMeldIpcHandlers() {
  ipcMain.handle('meld:list-tools', async () => {
    return getDefaultExternalTools()
  })

  ipcMain.handle('meld:launch-external-tool', async (_event, req: ILaunchToolRequest) => {
    const args = substituteArgs(req.tool, {
      leftPath: req.leftPath,
      rightPath: req.rightPath,
      basePath: req.basePath,
    })
    return new Promise<{ success: boolean; error?: string }>(resolve => {
      const [cmd, ...cmdArgs] = args
      const child = spawn(cmd!, cmdArgs, { detached: true, stdio: 'ignore' })
      child.on('error', err => {
        resolve({ success: false, error: `Failed to launch tool: ${err.message}` })
      })
      child.on('spawn', () => {
        child.unref()
        resolve({ success: true })
      })
    })
  })
}
```

- [ ] **Step 2: Create the public exports**

```typescript
// app/src/main-process/meld/index.ts
export { registerMeldIpcHandlers } from './meld-ipc'
```

- [ ] **Step 3: Wire it into main process startup**

Open `app/src/main-process/main.ts`. Find the section that registers other IPC handlers (e.g., `registerGitIpcHandlers` or similar — use `git grep -n "ipcMain" app/src/main-process/main.ts` to find). Add an import at the top:

```typescript
import { registerMeldIpcHandlers } from './meld'
```

Add the call where other IPC handlers are registered (inside `app.on('ready', ...)` if that's where they live, or at module top-level if they're top-level):

```typescript
registerMeldIpcHandlers()
```

- [ ] **Step 4: Verify build still works**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add app/src/main-process/meld/meld-ipc.ts app/src/main-process/meld/index.ts app/src/main-process/main.ts
git commit -m "feat(meld): add main-process IPC handlers for list-tools and launch-external-tool"
```

---

## Task 7: Add main-process Meld BrowserWindow lifecycle

**Files:**
- Create: `app/src/main-process/meld/meld-window.ts`

- [ ] **Step 1: Create the window manager**

```typescript
// app/src/main-process/meld/meld-window.ts
import { BrowserWindow, app } from 'electron'
import * as path from 'path'

interface IOpenMeldWindowArgs {
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: 'working' | 'commit' | 'merge'
}

const openWindows = new Map<string, BrowserWindow>()

function sessionKey(args: IOpenMeldWindowArgs): string {
  return `${args.repositoryID}:${args.filePath}:${args.mode}`
}

export function openMeldWindow(args: IOpenMeldWindowArgs): string {
  const key = sessionKey(args)
  const existing = openWindows.get(key)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return key
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: `Meld — ${path.basename(args.filePath)}`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
    },
  })

  // Build the URL with query string for the renderer to pick up
  const query = new URLSearchParams({
    repositoryID: String(args.repositoryID),
    filePath: args.filePath,
    mode: args.mode,
  }).toString()

  // Load the existing app's index.html with a special route, or load a
  // dedicated meld.html. For 1a, we use the same index.html with a query
  // param; the renderer decides which root component to mount.
  win.loadFile(path.join(__dirname, '../../index.html'), { hash: `meld?${query}` })

  win.on('closed', () => {
    openWindows.delete(key)
  })

  openWindows.set(key, win)
  return key
}

export function getOpenMeldWindows(): ReadonlyArray<BrowserWindow> {
  return Array.from(openWindows.values()).filter(w => !w.isDestroyed())
}
```

- [ ] **Step 2: Add the handler to meld-ipc.ts**

Open `app/src/main-process/meld/meld-ipc.ts` and add:

```typescript
import { openMeldWindow } from './meld-window'

// ...inside registerMeldIpcHandlers:
ipcMain.handle('meld:open-window', async (_event, args: IOpenMeldWindowArgs) => {
  const sessionID = openMeldWindow(args)
  return { sessionID }
})
```

Add the type definition near the imports:

```typescript
interface IOpenMeldWindowArgs {
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: 'working' | 'commit' | 'merge'
}
```

- [ ] **Step 3: Verify build still works**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/src/main-process/meld/meld-window.ts app/src/main-process/meld/meld-ipc.ts
git commit -m "feat(meld): add BrowserWindow lifecycle for Meld window"
```

---

## Task 8: Add MeldFileTree component (TDD)

**Files:**
- Create: `app/src/ui/meld/MeldFileTree.tsx`
- Test: `app/test/unit/ui/meld/MeldFileTree-test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// app/test/unit/ui/meld/MeldFileTree-test.tsx
import * as React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { MeldFileTree, IMeldFileTreeProps } from '../../../../src/ui/meld/MeldFileTree'

describe('MeldFileTree', () => {
  const defaultProps: IMeldFileTreeProps = {
    files: [
      { path: 'src/a.ts', status: 'modified' },
      { path: 'src/b.ts', status: 'added' },
      { path: 'README.md', status: 'deleted' },
    ],
    selectedPath: null,
    onFileSelected: jest.fn(),
  }

  it('renders all files', () => {
    const { getByText } = render(<MeldFileTree {...defaultProps} />)
    expect(getByText('src/a.ts')).not.toBeNull()
    expect(getByText('src/b.ts')).not.toBeNull()
    expect(getByText('README.md')).not.toBeNull()
  })

  it('calls onFileSelected when a file is clicked', () => {
    const onFileSelected = jest.fn()
    const { getByText } = render(
      <MeldFileTree {...defaultProps} onFileSelected={onFileSelected} />
    )
    fireEvent.click(getByText('src/a.ts'))
    expect(onFileSelected).toHaveBeenCalledWith('src/a.ts')
  })

  it('highlights the selected file', () => {
    const { container } = render(
      <MeldFileTree {...defaultProps} selectedPath="src/a.ts" />
    )
    const selectedRow = container.querySelector('[data-selected="true"]')
    expect(selectedRow).not.toBeNull()
    expect(selectedRow!.textContent).toContain('src/a.ts')
  })

  it('shows change status icons', () => {
    const { container } = render(<MeldFileTree {...defaultProps} />)
    expect(container.querySelector('[data-status="modified"]')).not.toBeNull()
    expect(container.querySelector('[data-status="added"]')).not.toBeNull()
    expect(container.querySelector('[data-status="deleted"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:unit --testPathPattern=MeldFileTree-test 2>&1 | tail -10`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write the minimal implementation**

```typescript
// app/src/ui/meld/MeldFileTree.tsx
import * as React from 'react'

export type IFileStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed'

export interface IMeldFile {
  readonly path: string
  readonly status: IFileStatus
}

export interface IMeldFileTreeProps {
  readonly files: ReadonlyArray<IMeldFile>
  readonly selectedPath: string | null
  readonly onFileSelected: (path: string) => void
}

export class MeldFileTree extends React.Component<IMeldFileTreeProps, {}> {
  public render() {
    return (
      <div className="meld-file-tree" role="tree" aria-label="Changed files">
        {this.props.files.map(f => (
          <div
            key={f.path}
            role="treeitem"
            data-selected={this.props.selectedPath === f.path}
            data-status={f.status}
            onClick={() => this.props.onFileSelected(f.path)}
            className="meld-file-tree-row"
            aria-label={`${f.path}, ${f.status}`}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                this.props.onFileSelected(f.path)
              }
            }}
          >
            <span className={`meld-file-status meld-file-status-${f.status}`} aria-hidden="true">
              {statusIcon(f.status)}
            </span>
            <span className="meld-file-path">{f.path}</span>
          </div>
        ))}
      </div>
    )
  }
}

function statusIcon(status: IFileStatus): string {
  switch (status) {
    case 'modified': return 'M'
    case 'added': return 'A'
    case 'deleted': return 'D'
    case 'untracked': return '?'
    case 'renamed': return 'R'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:unit --testPathPattern=MeldFileTree-test 2>&1 | tail -10`
Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/meld/MeldFileTree.tsx app/test/unit/ui/meld/MeldFileTree-test.tsx
git commit -m "feat(meld): add MeldFileTree component"
```

---

## Task 9: Add MeldDiffPane component (TDD)

**Files:**
- Create: `app/src/ui/meld/MeldDiffPane.tsx`
- Test: `app/test/unit/ui/meld/MeldDiffPane-test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// app/test/unit/ui/meld/MeldDiffPane-test.tsx
import * as React from 'react'
import { render } from '@testing-library/react'
import { MeldDiffPane, IMeldDiffPaneProps } from '../../../../src/ui/meld/MeldDiffPane'
import { IDiff, DiffType } from '../../../../src/models/diff'

describe('MeldDiffPane', () => {
  const sampleDiff: IDiff = {
    kind: DiffType.Text,
    text: '@@ -1,3 +1,3 @@\n line1\n-old\n+new\n line3',
    hunks: [],
  }

  const defaultProps: IMeldDiffPaneProps = {
    filePath: 'src/example.ts',
    diff: sampleDiff,
    loading: false,
  }

  it('renders the file path', () => {
    const { getByText } = render(<MeldDiffPane {...defaultProps} />)
    expect(getByText('src/example.ts')).not.toBeNull()
  })

  it('shows loading state when loading is true', () => {
    const { getByText } = render(<MeldDiffPane {...defaultProps} loading={true} diff={null} />)
    expect(getByText(/loading/i)).not.toBeNull()
  })

  it('shows empty state when diff is null and not loading', () => {
    const { getByText } = render(<MeldDiffPane {...defaultProps} diff={null} />)
    expect(getByText(/no changes/i)).not.toBeNull()
  })

  it('renders the diff content in a side-by-side layout', () => {
    const { container } = render(<MeldDiffPane {...defaultProps} />)
    expect(container.querySelector('.meld-diff-pane-side-by-side')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:unit --testPathPattern=MeldDiffPane-test 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: Find the existing IDiff model**

Run: `git grep -n "interface IDiff\|export.*IDiff\|DiffType" app/src/models/diff.ts 2>/dev/null | head -10`
Use the existing types from `app/src/models/diff.ts`. The exact field names may vary slightly — adjust the test to match.

- [ ] **Step 4: Write the minimal implementation**

```typescript
// app/src/ui/meld/MeldDiffPane.tsx
import * as React from 'react'
import { IDiff } from '../../models/diff'

export interface IMeldDiffPaneProps {
  readonly filePath: string
  readonly diff: IDiff | null
  readonly loading: boolean
}

export class MeldDiffPane extends React.Component<IMeldDiffPaneProps, {}> {
  public render() {
    const { filePath, diff, loading } = this.props
    return (
      <div className="meld-diff-pane">
        <div className="meld-diff-pane-header" role="heading" aria-level={2}>
          {filePath}
        </div>
        {loading && <div className="meld-loading" role="status">Loading diff…</div>}
        {!loading && !diff && (
          <div className="meld-empty-state" role="status">No changes to display.</div>
        )}
        {!loading && diff && (
          <div className="meld-diff-pane-side-by-side">
            <pre className="meld-diff-raw">{diff.text}</pre>
          </div>
        )}
      </div>
    )
  }
}
```

For 1a, the diff pane shows a raw text rendering. In Phase 1b this will be replaced by MeldEditorPane (editable) and in later phases by the structured rendering. For 1a, raw text proves the data flow works.

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test:unit --testPathPattern=MeldDiffPane-test 2>&1 | tail -10`
Expected: PASS — 4 tests pass

- [ ] **Step 6: Commit**

```bash
git add app/src/ui/meld/MeldDiffPane.tsx app/test/unit/ui/meld/MeldDiffPane-test.tsx
git commit -m "feat(meld): add MeldDiffPane component (raw rendering for 1a)"
```

---

## Task 10: Add MeldToolbar component (TDD)

**Files:**
- Create: `app/src/ui/meld/MeldToolbar.tsx`
- Test: `app/test/unit/ui/meld/MeldToolbar-test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// app/test/unit/ui/meld/MeldToolbar-test.tsx
import * as React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { MeldToolbar, IMeldToolbarProps, IMeldFilter } from '../../../../src/ui/meld/MeldToolbar'
import { IExternalTool } from '../../../../src/models/external-tool'

describe('MeldToolbar', () => {
  const tools: IExternalTool[] = [
    { id: 'meld', name: 'Meld', command: 'meld', args: '%L %R', builtIn: true },
    { id: 'kdiff3', name: 'KDiff3', command: 'kdiff3', args: '%L %R', builtIn: true },
  ]

  const defaultProps: IMeldToolbarProps = {
    repositoryName: 'my-repo',
    filePath: 'src/example.ts',
    filter: 'all' as IMeldFilter,
    mode: 'side-by-side' as const,
    availableTools: tools,
    onFilterChanged: jest.fn(),
    onModeChanged: jest.fn(),
    onExternalToolLaunched: jest.fn(),
  }

  it('renders the repository name and file path', () => {
    const { getByText } = render(<MeldToolbar {...defaultProps} />)
    expect(getByText('my-repo')).not.toBeNull()
    expect(getByText('src/example.ts')).not.toBeNull()
  })

  it('calls onFilterChanged when filter dropdown changes', () => {
    const onFilterChanged = jest.fn()
    const { getByLabelText } = render(
      <MeldToolbar {...defaultProps} onFilterChanged={onFilterChanged} />
    )
    fireEvent.change(getByLabelText(/filter/i), { target: { value: 'changes' } })
    expect(onFilterChanged).toHaveBeenCalledWith('changes')
  })

  it('calls onModeChanged when mode toggle changes', () => {
    const onModeChanged = jest.fn()
    const { getByLabelText } = render(
      <MeldToolbar {...defaultProps} onModeChanged={onModeChanged} />
    )
    fireEvent.click(getByLabelText(/unified/i))
    expect(onModeChanged).toHaveBeenCalledWith('unified')
  })

  it('renders external tool dropdown with all available tools', () => {
    const { getByText } = render(<MeldToolbar {...defaultProps} />)
    // Open the dropdown
    fireEvent.click(getByText(/external tool/i))
    expect(getByText('Meld')).not.toBeNull()
    expect(getByText('KDiff3')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:unit --testPathPattern=MeldToolbar-test 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: Write the minimal implementation**

```typescript
// app/src/ui/meld/MeldToolbar.tsx
import * as React from 'react'
import { IExternalTool } from '../../models/external-tool'

export type IMeldFilter = 'all' | 'changes' | 'identical' | 'untracked'
export type IMeldMode = 'side-by-side' | 'unified'

export interface IMeldToolbarProps {
  readonly repositoryName: string
  readonly filePath: string
  readonly filter: IMeldFilter
  readonly mode: IMeldMode
  readonly availableTools: ReadonlyArray<IExternalTool>
  readonly onFilterChanged: (filter: IMeldFilter) => void
  readonly onModeChanged: (mode: IMeldMode) => void
  readonly onExternalToolLaunched: (tool: IExternalTool) => void
}

interface IMeldToolbarState {
  readonly toolDropdownOpen: boolean
}

export class MeldToolbar extends React.Component<IMeldToolbarProps, IMeldToolbarState> {
  public constructor(props: IMeldToolbarProps) {
    super(props)
    this.state = { toolDropdownOpen: false }
  }

  private onToolClicked = (tool: IExternalTool) => {
    this.setState({ toolDropdownOpen: false })
    this.props.onExternalToolLaunched(tool)
  }

  public render() {
    const { repositoryName, filePath, filter, mode, availableTools } = this.props
    return (
      <div className="meld-toolbar" role="toolbar" aria-label="Meld toolbar">
        <span className="meld-toolbar-repository">{repositoryName}</span>
        <span className="meld-toolbar-separator" aria-hidden="true">/</span>
        <span className="meld-toolbar-file">{filePath}</span>

        <label className="meld-toolbar-field">
          <span>Filter:</span>
          <select
            value={filter}
            onChange={e => this.props.onFilterChanged(e.target.value as IMeldFilter)}
            aria-label="Filter"
          >
            <option value="all">Show all</option>
            <option value="changes">Show changes</option>
            <option value="identical">Show identical</option>
            <option value="untracked">Show untracked</option>
          </select>
        </label>

        <div className="meld-toolbar-mode-toggle" role="radiogroup" aria-label="Diff mode">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'side-by-side'}
            onClick={() => this.props.onModeChanged('side-by-side')}
          >
            Side-by-side
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'unified'}
            aria-label="Unified"
            onClick={() => this.props.onModeChanged('unified')}
          >
            Unified
          </button>
        </div>

        <div className="meld-toolbar-external-tool">
          <button
            type="button"
            onClick={() => this.setState({ toolDropdownOpen: !this.state.toolDropdownOpen })}
            aria-haspopup="true"
            aria-expanded={this.state.toolDropdownOpen}
          >
            External tool ▾
          </button>
          {this.state.toolDropdownOpen && (
            <ul className="meld-toolbar-tool-list" role="menu">
              {availableTools.map(t => (
                <li key={t.id} role="menuitem">
                  <button type="button" onClick={() => this.onToolClicked(t)}>
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:unit --testPathPattern=MeldToolbar-test 2>&1 | tail -10`
Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/meld/MeldToolbar.tsx app/test/unit/ui/meld/MeldToolbar-test.tsx
git commit -m "feat(meld): add MeldToolbar component (filter, mode, external tool dropdown)"
```

---

## Task 11: Add ExternalToolsSettings component

**Files:**
- Create: `app/src/ui/meld/settings/ExternalToolsSettings.tsx`

- [ ] **Step 1: Create the settings component**

```typescript
// app/src/ui/meld/settings/ExternalToolsSettings.tsx
import * as React from 'react'
import { IExternalTool } from '../../../models/external-tool'

export interface IExternalToolsSettingsProps {
  readonly tools: ReadonlyArray<IExternalTool>
  readonly onToolAdded: (tool: Omit<IExternalTool, 'id' | 'builtIn'>) => void
  readonly onToolUpdated: (tool: IExternalTool) => void
  readonly onToolRemoved: (toolID: string) => void
}

interface IExternalToolsSettingsState {
  readonly newToolName: string
  readonly newToolCommand: string
  readonly newToolArgs: string
}

export class ExternalToolsSettings extends React.Component<
  IExternalToolsSettingsProps,
  IExternalToolsSettingsState
> {
  public constructor(props: IExternalToolsSettingsProps) {
    super(props)
    this.state = { newToolName: '', newToolCommand: '', newToolArgs: '%L %R' }
  }

  private onAddClicked = () => {
    const { newToolName, newToolCommand, newToolArgs } = this.state
    if (newToolName.trim() === '' || newToolCommand.trim() === '') return
    this.props.onToolAdded({
      name: newToolName.trim(),
      command: newToolCommand.trim(),
      args: newToolArgs.trim() || '%L %R',
    })
    this.setState({ newToolName: '', newToolCommand: '', newToolArgs: '%L %R' })
  }

  public render() {
    return (
      <div className="external-tools-settings">
        <h2>External diff tools</h2>
        <p>
          Add or edit the diff tools you can launch from the Meld window.
          Use <code>%L</code> for the left/old path, <code>%R</code> for the right/new path,
          and <code>%B</code> for the base path (3-way merge only).
        </p>

        <table className="external-tools-list">
          <thead>
            <tr>
              <th>Name</th>
              <th>Command</th>
              <th>Args</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {this.props.tools.map(t => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.command}</td>
                <td>{t.args}</td>
                <td>
                  {!t.builtIn && (
                    <button type="button" onClick={() => this.props.onToolRemoved(t.id)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <fieldset>
          <legend>Add new tool</legend>
          <label>
            <span>Name</span>
            <input
              type="text"
              value={this.state.newToolName}
              onChange={e => this.setState({ newToolName: e.target.value })}
              aria-label="Tool name"
            />
          </label>
          <label>
            <span>Command</span>
            <input
              type="text"
              value={this.state.newToolCommand}
              onChange={e => this.setState({ newToolCommand: e.target.value })}
              aria-label="Tool command"
              placeholder="e.g. meld or /usr/local/bin/meld"
            />
          </label>
          <label>
            <span>Args</span>
            <input
              type="text"
              value={this.state.newToolArgs}
              onChange={e => this.setState({ newToolArgs: e.target.value })}
              aria-label="Tool args"
              placeholder="%L %R"
            />
          </label>
          <button type="button" onClick={this.onAddClicked}>Add tool</button>
        </fieldset>
      </div>
    )
  }
}
```

- [ ] **Step 2: Verify build succeeds**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/src/ui/meld/settings/ExternalToolsSettings.tsx
git commit -m "feat(meld): add ExternalToolsSettings component"
```

---

## Task 12: Add MeldWindow component (orchestrator)

**Files:**
- Create: `app/src/ui/meld/MeldWindow.tsx`
- Test: `app/test/unit/ui/meld/MeldWindow-test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// app/test/unit/ui/meld/MeldWindow-test.tsx
import * as React from 'react'
import { render } from '@testing-library/react'
import { MeldWindow, IMeldWindowProps } from '../../../../src/ui/meld/MeldWindow'
import { IDiff, DiffType } from '../../../../src/models/diff'

describe('MeldWindow', () => {
  const sampleDiff: IDiff = {
    kind: DiffType.Text,
    text: '@@ -1,3 +1,3 @@\n line1\n-old\n+new\n line3',
    hunks: [],
  }

  const defaultProps: IMeldWindowProps = {
    repositoryID: 1,
    filePath: 'src/example.ts',
    mode: 'working',
    files: [
      { path: 'src/example.ts', status: 'modified' },
      { path: 'README.md', status: 'added' },
    ],
    availableTools: [
      { id: 'meld', name: 'Meld', command: 'meld', args: '%L %R', builtIn: true },
    ],
    onGetDiff: jest.fn(async () => sampleDiff),
    onLaunchExternalTool: jest.fn(async () => ({ success: true })),
    onClose: jest.fn(),
  }

  it('renders the toolbar, file tree, and diff pane', () => {
    const { getByText } = render(<MeldWindow {...defaultProps} />)
    expect(getByText('src/example.ts')).not.toBeNull()
    expect(getByText('README.md')).not.toBeNull()
  })

  it('calls onGetDiff on mount with the initial file path', async () => {
    render(<MeldWindow {...defaultProps} />)
    // onGetDiff is called as part of componentDidMount
    // Wait one microtask for the async dispatch
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(defaultProps.onGetDiff).toHaveBeenCalledWith(
      1,
      'src/example.ts',
      'working'
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:unit --testPathPattern=MeldWindow-test 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: Find the IDiff type**

Run: `git grep -n "interface IDiff\|export.*IDiff" app/src/models/diff.ts 2>/dev/null | head -5`
Verify the IDiff shape matches what you use. Adjust if needed.

- [ ] **Step 4: Write the implementation**

```typescript
// app/src/ui/meld/MeldWindow.tsx
import * as React from 'react'
import { IExternalTool } from '../../models/external-tool'
import { IDiff } from '../../models/diff'
import { MeldFileTree, IMeldFile } from './MeldFileTree'
import { MeldDiffPane } from './MeldDiffPane'
import { MeldToolbar, IMeldFilter, IMeldMode } from './MeldToolbar'
import { substituteArgs } from '../../lib/meld/external-tool-args'

export type IMeldMode = 'working' | 'commit' | 'merge'

export interface IMeldWindowProps {
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: IMeldMode
  readonly files: ReadonlyArray<IMeldFile>
  readonly availableTools: ReadonlyArray<IExternalTool>
  readonly onGetDiff: (
    repositoryID: number,
    filePath: string,
    mode: IMeldMode
  ) => Promise<IDiff>
  readonly onLaunchExternalTool: (
    tool: IExternalTool,
    leftPath: string,
    rightPath: string,
    basePath?: string
  ) => Promise<{ success: boolean; error?: string }>
  readonly onClose: () => void
}

interface IMeldWindowState {
  readonly selectedPath: string | null
  readonly diff: IDiff | null
  readonly diffLoading: boolean
  readonly filter: IMeldFilter
  readonly mode: IMeldMode
  readonly errorMessage: string | null
}

export class MeldWindow extends React.Component<IMeldWindowProps, IMeldWindowState> {
  public constructor(props: IMeldWindowProps) {
    super(props)
    this.state = {
      selectedPath: props.filePath,
      diff: null,
      diffLoading: true,
      filter: 'all',
      mode: 'side-by-side',
      errorMessage: null,
    }
  }

  public componentDidMount() {
    void this.loadDiff(this.props.filePath)
  }

  private async loadDiff(filePath: string) {
    this.setState({ diffLoading: true, errorMessage: null })
    try {
      const diff = await this.props.onGetDiff(this.props.repositoryID, filePath, this.props.mode)
      this.setState({ diff, diffLoading: false, selectedPath: filePath })
    } catch (e) {
      this.setState({
        diffLoading: false,
        errorMessage: e instanceof Error ? e.message : 'Failed to load diff',
      })
    }
  }

  private onFileSelected = (path: string) => {
    void this.loadDiff(path)
  }

  private onFilterChanged = (filter: IMeldFilter) => {
    this.setState({ filter })
  }

  private onModeChanged = (mode: IMeldMode) => {
    this.setState({ mode })
  }

  private onExternalToolLaunched = async (tool: IExternalTool) => {
    // For 1a, the left/right paths are derived from the diff's old/new.
    // The actual file content paths come from the diff metadata. For
    // 1a we pass the filePath as both; proper 3-way diff paths come
    // in 1c.
    const { filePath } = this.props
    const result = await this.props.onLaunchExternalTool(
      tool,
      filePath + '.left',
      filePath + '.right'
    )
    if (!result.success) {
      this.setState({ errorMessage: result.error || 'Failed to launch tool' })
    }
  }

  private onClose = () => {
    this.props.onClose()
  }

  public render() {
    const { files, availableTools, filePath } = this.props
    const { selectedPath, diff, diffLoading, filter, mode, errorMessage } = this.state
    return (
      <div className="meld-window">
        <MeldToolbar
          repositoryName={`Repository ${this.props.repositoryID}`}
          filePath={selectedPath || filePath}
          filter={filter}
          mode={mode}
          availableTools={availableTools}
          onFilterChanged={this.onFilterChanged}
          onModeChanged={this.onModeChanged}
          onExternalToolLaunched={this.onExternalToolLaunched}
        />
        {errorMessage && (
          <div className="meld-error-banner" role="alert">{errorMessage}</div>
        )}
        <div className="meld-window-body">
          <MeldFileTree
            files={files}
            selectedPath={selectedPath}
            onFileSelected={this.onFileSelected}
          />
          <MeldDiffPane
            filePath={selectedPath || filePath}
            diff={diff}
            loading={diffLoading}
          />
        </div>
        <div className="meld-window-footer">
          <button type="button" onClick={this.onClose} aria-label="Close Meld window">
            Close
          </button>
        </div>
      </div>
    )
  }
}
```

Note: in production, `onGetDiff` would call into the dispatcher which fetches the diff from git. The `onLaunchExternalTool` would call into IPC. For 1a's tests, the props are just callbacks. The wiring to real dispatcher/IPC happens in the next task.

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test:unit --testPathPattern=MeldWindow-test 2>&1 | tail -10`
Expected: PASS — 2 tests pass

- [ ] **Step 6: Commit**

```bash
git add app/src/ui/meld/MeldWindow.tsx app/test/unit/ui/meld/MeldWindow-test.tsx
git commit -m "feat(meld): add MeldWindow orchestrator component"
```

---

## Task 13: Add Meld dispatcher actions

**Files:**
- Modify: `app/src/ui/dispatcher/dispatcher.ts`

- [ ] **Step 1: Find the right place to add the new actions**

Run: `git grep -n "openInBrowser\|openExternal\|class Dispatcher" app/src/ui/dispatcher/dispatcher.ts 2>/dev/null | head -10`
Look for existing methods on the Dispatcher class that perform async UI actions. Add the new methods near them.

- [ ] **Step 2: Add the new dispatcher methods**

Add these methods to the Dispatcher class (find a good spot — usually alphabetical with other "open*" methods or near `openInBrowser`):

```typescript
  public async openInMeldWindow(
    repository: Repository,
    filePath: string,
    mode: 'working' | 'commit' | 'merge' = 'working'
  ): Promise<void> {
    await this.emitter.emit('open-in-meld-window', repository, filePath, mode)
  }

  public async listExternalTools(): Promise<ReadonlyArray<IExternalTool>> {
    return this.appStore.getExternalTools()
  }

  public async configureExternalTool(
    tool: Omit<IExternalTool, 'id' | 'builtIn'>
  ): Promise<void> {
    await this.appStore.configureExternalTool(tool)
  }

  public async removeExternalTool(toolID: string): Promise<void> {
    await this.appStore.removeExternalTool(toolID)
  }

  public async launchExternalTool(
    tool: IExternalTool,
    leftPath: string,
    rightPath: string,
    basePath?: string
  ): Promise<{ success: boolean; error?: string }> {
    // Delegate to a main-process IPC call. For 1a this is wired via
    // the existing emit pattern; full IPC integration is in Task 15.
    return this.emitter.emit('launch-external-tool', tool, leftPath, rightPath, basePath)
  }
```

Add the imports at the top:

```typescript
import { IExternalTool } from '../../models/external-tool'
```

- [ ] **Step 3: Verify build still works**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds (the emit calls are unbound; we'll bind them next)

- [ ] **Step 4: Commit**

```bash
git add app/src/ui/dispatcher/dispatcher.ts
git commit -m "feat(meld): add dispatcher actions for Meld window and external tools"
```

---

## Task 14: Wire up app-store methods for external tools

**Files:**
- Modify: `app/src/lib/app-state.ts` (or wherever the AppStore class lives — check `git grep -n "class AppStore" app/src/lib/stores/app-store.ts`)

- [ ] **Step 1: Add the methods**

In the AppStore class (likely `app/src/lib/stores/app-store.ts`), add:

```typescript
  public getExternalTools(): ReadonlyArray<IExternalTool> {
    return this.getState().externalTools
  }

  public async configureExternalTool(
    partial: Omit<IExternalTool, 'id' | 'builtIn'>
  ): Promise<void> {
    const newTool: IExternalTool = {
      ...partial,
      id: `custom-${Date.now()}`,
      builtIn: false,
    }
    const existing = this.getState().externalTools
    // Replace if a custom tool with same name exists
    const filtered = existing.filter(t => !(t.name === newTool.name && !t.builtIn))
    await this._updateState({ externalTools: [...filtered, newTool] })
  }

  public async removeExternalTool(toolID: string): Promise<void> {
    const existing = this.getState().externalTools
    const target = existing.find(t => t.id === toolID)
    if (target?.builtIn) {
      throw new Error('Cannot remove a built-in tool')
    }
    await this._updateState({
      externalTools: existing.filter(t => t.id !== toolID),
    })
  }
```

(Adjust `_updateState` to match the actual method name in the AppStore class — check with `git grep -n "_updateState\|updateState" app/src/lib/stores/app-store.ts | head -5`.)

- [ ] **Step 2: Verify build succeeds**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/stores/app-store.ts
git commit -m "feat(meld): add AppStore methods for external tools CRUD"
```

---

## Task 15: Add Meld menu integration (context menu)

**Files:**
- Create: `app/src/main-process/meld/menu-integration.ts`

- [ ] **Step 1: Create the menu module**

```typescript
// app/src/main-process/meld/menu-integration.ts
import { MenuItemConstructorOptions, Menu } from 'electron'
import { IRepository } from './repository-state'
import { emitMeldOpenWindow } from './meld-window'

export function buildMeldContextMenuItems(
  repository: IRepository,
  filePath: string,
  mode: 'working' | 'commit' | 'merge' = 'working'
): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Open in Meld Window',
      click: () => emitMeldOpenWindow(repository, filePath, mode),
    },
  ]
}
```

- [ ] **Step 2: Add the `emitMeldOpenWindow` helper**

In `app/src/main-process/meld/meld-window.ts`, add:

```typescript
export function emitMeldOpenWindow(
  repository: { id: number },
  filePath: string,
  mode: 'working' | 'commit' | 'merge'
): void {
  openMeldWindow({
    repositoryID: repository.id,
    filePath,
    mode,
  })
}
```

(Adjust the `IRepository` type to match what's already in `app/src/main-process/repository-state.ts` if it exists; otherwise use `{ id: number }`.)

- [ ] **Step 3: Verify build succeeds**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/src/main-process/meld/menu-integration.ts app/src/main-process/meld/meld-window.ts
git commit -m "feat(meld): add context menu 'Open in Meld Window' item"
```

---

## Task 16: Add E2E test for Meld basic flow

**Files:**
- Create: `app/test/e2e/meld/meld-basic-flow-test.ts`

- [ ] **Step 1: Find the existing E2E test patterns**

Run: `ls app/test/e2e/ 2>&1 | head -20 ; echo "---example e2e test:" ; cat app/test/e2e/example-test.ts 2>/dev/null | head -50 || git log --oneline app/test/e2e/ 2>&1 | head -5`
Look at the existing E2E test setup (Playwright config, test patterns) to understand the conventions.

- [ ] **Step 2: Create the E2E test**

```typescript
// app/test/e2e/meld/meld-basic-flow-test.ts
import { test, expect } from '@playwright/test'

test.describe('Meld basic flow', () => {
  test('opens Meld window from context menu and shows diff', async ({ page, context }) => {
    // Set up: open the main app, sign in (or skip if test env)
    await page.goto('/')

    // Right-click on a changed file in the changes list
    const fileRow = page.locator('[data-testid="changed-file"]').first()
    await expect(fileRow).toBeVisible({ timeout: 10_000 })
    await fileRow.click({ button: 'right' })

    // Click "Open in Meld Window"
    await page.click('text=Open in Meld Window')

    // Wait for the new BrowserWindow to open
    const meldPage = await context.waitForEvent('page', { timeout: 10_000 })
    await meldPage.waitForLoadState('domcontentloaded')

    // Verify Meld window rendered
    await expect(meldPage.locator('.meld-window')).toBeVisible()
    await expect(meldPage.locator('.meld-toolbar')).toBeVisible()
    await expect(meldPage.locator('.meld-file-tree')).toBeVisible()
    await expect(meldPage.locator('.meld-diff-pane')).toBeVisible()
  })

  test('external tool dropdown lists configured tools', async ({ page, context }) => {
    await page.goto('/')
    const fileRow = page.locator('[data-testid="changed-file"]').first()
    await fileRow.click({ button: 'right' })
    await page.click('text=Open in Meld Window')
    const meldPage = await context.waitForEvent('page', { timeout: 10_000 })

    // Open the external tool dropdown
    await meldPage.click('text=External tool')
    // Verify Meld and KDiff3 appear
    await expect(meldPage.locator('text=Meld')).toBeVisible()
    await expect(meldPage.locator('text=KDiff3')).toBeVisible()
  })
})
```

- [ ] **Step 3: Verify the test file is recognized**

Run: `yarn test:e2e --list 2>&1 | head -10`
Expected: The new test file appears in the list

(Don't actually run the E2E test in CI yet — it requires a running app. We'll verify it manually in the smoke test.)

- [ ] **Step 4: Commit**

```bash
git add app/test/e2e/meld/meld-basic-flow-test.ts
git commit -m "test(meld): add E2E test for Meld basic flow"
```

---

## Task 17: Wire MeldWindow mount point

**Files:**
- Modify: `app/src/ui/index.tsx` (or wherever the app's React root is mounted)

- [ ] **Step 1: Find the React root mount**

Run: `git grep -n "MeldWindow\|HashRouter\|hash.*meld\|getElementById" app/src/ui/index.tsx 2>/dev/null | head -10`
Look for the ReactDOM.render call and the route logic.

- [ ] **Step 2: Add the Meld route detection**

In the entry point component (likely `app/src/ui/index.tsx`), add logic that checks the URL hash and renders `<MeldWindow>` if it starts with `meld?`:

```typescript
import { MeldWindow } from './meld'

function parseMeldArgsFromHash(): { repositoryID: number; filePath: string; mode: 'working' | 'commit' | 'merge' } | null {
  const hash = window.location.hash
  if (!hash.startsWith('#meld?')) return null
  const params = new URLSearchParams(hash.substring('#meld?'.length))
  const repositoryID = Number(params.get('repositoryID'))
  const filePath = params.get('filePath') || ''
  const mode = (params.get('mode') || 'working') as 'working' | 'commit' | 'merge'
  if (isNaN(repositoryID) || filePath === '') return null
  return { repositoryID, filePath, mode }
}

// ...in the render method, before the regular app render:
const meldArgs = parseMeldArgsFromHash()
if (meldArgs) {
  return (
    <MeldWindow
      {...meldArgs}
      files={[]}
      availableTools={...}
      onGetDiff={async (id, path, mode) => /* call dispatcher */}
      onLaunchExternalTool={async (tool, l, r, b) => /* call IPC */}
      onClose={() => window.close()}
    />
  )
}
```

The exact integration point depends on how the existing app handles routing. Use `git grep -n "HashRouter\|hash.*location" app/src/ui/index.tsx app/src/ui/app.tsx 2>/dev/null` to find the right place.

- [ ] **Step 3: Verify build succeeds**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Smoke test manually**

Run: `yarn build:prod 2>&1 | tail -3 && yarn start 2>&1 | head -10`
Expected: App launches. The Meld window entry point is wired (no UI to trigger it yet — that's the next task).

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/index.tsx
git commit -m "feat(meld): wire MeldWindow as a route in the React entry point"
```

---

## Task 18: Wire dispatcher.emit handlers in app.tsx

**Files:**
- Modify: `app/src/ui/app.tsx`

- [ ] **Step 1: Find the dispatcher emit bindings**

Run: `git grep -n "emitter.on\|emitter.emit\|onDidLoad" app/src/ui/app.tsx 2>/dev/null | head -10`
Look for the existing pattern of binding `emitter.on(...)` to dispatcher methods.

- [ ] **Step 2: Add the new emit bindings**

In the app's componentDidMount (or wherever the emit handlers live), add:

```typescript
  private onMeldOpenWindow = (
    repository: Repository,
    filePath: string,
    mode: 'working' | 'commit' | 'merge'
  ) => {
    // Send IPC to main process to open the BrowserWindow
    ipcRenderer.send('meld:open-window', { repositoryID: repository.id, filePath, mode })
  }

  private onLaunchExternalTool = async (
    tool: IExternalTool,
    leftPath: string,
    rightPath: string,
    basePath?: string
  ) => {
    return ipcRenderer.invoke('meld:launch-external-tool', {
      tool,
      leftPath,
      rightPath,
      basePath,
    })
  }
```

Bind them in componentDidMount:

```typescript
  public componentDidMount() {
    this.props.dispatcheremitter.on('open-in-meld-window', this.onMeldOpenWindow)
    this.props.dispatcheremitter.on('launch-external-tool', this.onLaunchExternalTool)
  }
```

(Adjust to match the existing event-binding pattern in app.tsx — there may be a helper like `onDispatcherOperation` or a class-property binding.)

- [ ] **Step 3: Verify build succeeds**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/src/ui/app.tsx
git commit -m "feat(meld): wire dispatcher emits to IPC for Meld window and external tool"
```

---

## Task 19: Add keyboard shortcut for Meld window

**Files:**
- Modify: `app/src/main-process/menu/build-default-menu.ts`

- [ ] **Step 1: Find existing keyboard shortcut registrations**

Run: `git grep -n "registerAccelerator\|Ctrl+Shift\|CmdOrCtrl" app/src/main-process/menu/build-default-menu.ts 2>/dev/null | head -10`
Look at how existing menu items register keyboard accelerators.

- [ ] **Step 2: Add the Meld shortcut**

Find the "Repository" or "View" menu section. Add a new item:

```typescript
      {
        label: 'Open Current File in Meld Window',
        accelerator: 'CmdOrCtrl+Shift+D',
        click: () => emitMeldOpenWindowForCurrentFile(),
      },
```

Add the helper at the top of the file:

```typescript
import { emitMeldOpenWindow } from '../meld/meld-window'
import { getActiveRepository, getActiveFilePath } from './menu-state-helpers'

function emitMeldOpenWindowForCurrentFile() {
  const repository = getActiveRepository()
  const filePath = getActiveFilePath()
  if (repository && filePath) {
    emitMeldOpenWindow(repository, filePath, 'working')
  }
}
```

(Adjust imports and helper names to match the existing patterns.)

- [ ] **Step 3: Verify build succeeds**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/src/main-process/menu/build-default-menu.ts
git commit -m "feat(meld): add Ctrl+Shift+D shortcut to open current file in Meld window"
```

---

## Task 20: Add SCSS styles for the Meld components

**Files:**
- Create: `app/styles/ui/meld/_meld-window.scss`
- Modify: `app/styles/ui/_index.scss` (or whatever imports the SCSS files)

- [ ] **Step 1: Create the SCSS file**

```scss
// app/styles/ui/meld/_meld-window.scss

.meld-window {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--meld-bg, #fafbfc);
}

.meld-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background-color: var(--meld-toolbar-bg, #f5f5f5);
  border-bottom: 1px solid var(--meld-border, #e3e3e3);

  &-repository {
    font-weight: 600;
  }
  &-separator {
    color: var(--meld-text-muted, #7a7878);
  }
  &-file {
    color: var(--meld-text-muted, #5a5858);
  }
  &-field {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  &-mode-toggle {
    display: flex;
    border: 1px solid var(--meld-border, #d1d1d1);
    border-radius: 4px;
    overflow: hidden;
    button {
      border: none;
      background: transparent;
      padding: 4px 12px;
      cursor: pointer;
      &[aria-checked="true"] {
        background-color: var(--meld-accent, #e5461f);
        color: white;
      }
    }
  }
  &-external-tool {
    position: relative;
    ul {
      position: absolute;
      top: 100%;
      right: 0;
      background: white;
      border: 1px solid var(--meld-border, #d1d1d1);
      list-style: none;
      padding: 4px 0;
      margin: 0;
      min-width: 200px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }
}

.meld-error-banner {
  background-color: #fee;
  color: #c93a18;
  padding: 8px 12px;
  border-bottom: 1px solid #fcc;
}

.meld-window-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.meld-file-tree {
  width: 280px;
  border-right: 1px solid var(--meld-border, #e3e3e3);
  overflow-y: auto;
  background-color: var(--meld-tree-bg, #fafbfc);

  &-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
    &:hover {
      background-color: var(--meld-tree-hover, #f0f0f0);
    }
    &[data-selected="true"] {
      background-color: var(--meld-accent-bg, #ffe6e0);
      border-left: 3px solid var(--meld-accent, #e5461f);
    }
  }
  &-status {
    display: inline-block;
    width: 16px;
    text-align: center;
    font-weight: 600;
    &-modified { color: #f59e0b; }
    &-added { color: #1a7a56; }
    &-deleted { color: #ef4444; }
    &-untracked { color: #3b82f6; }
    &-renamed { color: #8b5cf6; }
  }
  &-path {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
  }
}

.meld-diff-pane {
  flex: 1;
  overflow: auto;
  background-color: white;
  &-header {
    padding: 8px 12px;
    font-weight: 600;
    background-color: var(--meld-pane-header, #f5f5f5);
    border-bottom: 1px solid var(--meld-border, #e3e3e3);
    font-family: 'JetBrains Mono', monospace;
  }
  &-side-by-side {
    display: flex;
    flex: 1;
  }
  &-raw {
    flex: 1;
    padding: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre;
  }
}

.meld-loading,
.meld-empty-state {
  padding: 24px;
  text-align: center;
  color: var(--meld-text-muted, #7a7878);
}

.meld-window-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--meld-border, #e3e3e3);
  background-color: var(--meld-toolbar-bg, #f5f5f5);
  display: flex;
  justify-content: flex-end;
  button {
    padding: 6px 16px;
    border: 1px solid var(--meld-border, #d1d1d1);
    background: white;
    border-radius: 4px;
    cursor: pointer;
    &:hover {
      background-color: var(--meld-tree-hover, #f0f0f0);
    }
  }
}
```

- [ ] **Step 2: Add the import**

Find `app/styles/ui/_index.scss` (or the equivalent main SCSS file). Add:

```scss
@import './meld/meld-window';
```

- [ ] **Step 3: Verify build succeeds**

Run: `yarn build:prod 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/styles/ui/meld/_meld-window.scss app/styles/ui/_index.scss
git commit -m "style(meld): add SCSS for Meld window components"
```

---

## Task 21: Final smoke test and verify Phase 1a is shippable

**Files:**
- No code changes

- [ ] **Step 1: Run the full unit test suite**

Run: `yarn test:unit 2>&1 | tail -10`
Expected: All tests pass (existing + new Meld tests)

- [ ] **Step 2: Run ESLint**

Run: `yarn eslint 2>&1 | tail -5`
Expected: No new errors (Meld files conform to project style)

- [ ] **Step 3: Build production**

Run: `yarn build:prod 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Run yarn package**

Run: `yarn package 2>&1 | tail -5`
Expected: All 3 targets (deb, AppImage, snap) produced

- [ ] **Step 5: Commit any final fixes (if any)**

If the smoke test found any issues, fix them and commit:

```bash
git add -A
git commit -m "fix(meld): smoke test fixes for Phase 1a"
```

(Or skip this step if there are no fixes.)

- [ ] **Step 6: Mark Phase 1a complete**

Update the design doc's "Approval" section to say "Phase 1a complete, 2026-06-XX". Commit the doc update.

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] **Spec coverage**: Each feature in spec section "Phase 1a — Standalone Meld Window + External Tools" maps to one or more tasks above:
  - Standalone BrowserWindow → Task 7, 17
  - File tree sidebar → Task 8
  - Read-only side-by-side / unified → Task 9, 10
  - Filter modes → Task 10
  - External tool dropdown → Task 10, 11
  - 5 pre-populated tools → Task 3
  - Settings UI → Task 11, 14
  - Window state persistence → (DEFERRED — not in 1a)
  - Keyboard shortcut → Task 19
  - Menu integration → Task 15, 18
  - File path placeholders → Task 2
  - All ✓
- [ ] **Placeholder scan**: No "TBD" / "TODO" in plan ✓
- [ ] **Type consistency**: `IExternalTool` used identically across all tasks ✓
- [ ] **No gaps**: Every spec success criterion has a task ✓

## Success Criteria

Phase 1a is done when:
- All 21 tasks complete
- `yarn test:unit` passes
- `yarn eslint` passes
- `yarn build:prod` succeeds
- `yarn package` produces deb/AppImage/snap
- Manual smoke test: open Meld window from context menu, view diff, launch external tool

After 1a ships, move to Phase 1b (in-place editing + copy + char-level diff).
