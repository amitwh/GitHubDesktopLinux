# Meld-Style Diff Viewer + SmartGit Integration — Design

**Date:** 2026-06-05
**Status:** Design Approved (pending spec review)
**Branch:** `linux`
**Project:** GitHub Desktop Linux fork (`amitwh/GitHubDesktop`)

---

## Overview

Replace the modal-dialog SmartGit feature stubs with an integrated, Meld-style diff viewer that lives as a standalone BrowserWindow, supports in-place editing and 3-way merge, and folds all six SmartGit features (reflog, blame, stash, merge-conflict, interactive-rebase, submodule) into a single composable surface. Ship in four phases (1a → 1b → 1c → 2+3), each independently shippable.

The existing side-by-side diff viewer (`app/src/ui/diff/`, ~3,600 LOC) and the six SmartGit dialogs (each 70-155 LOC) are **not modified** in Phase 1. The new functionality lives in a parallel `app/src/ui/meld/` module and `app/src/lib/meld/` module, reusing existing primitives by composition.

---

## Goals & Non-Goals

### Goals

- A Meld-quality diff experience: side-by-side and unified views, in-place editing, copy-left/copy-right, character-level word diff, 3-way merge with conflict resolution, manual line alignment, filter modes, file-tree sidebar.
- All six SmartGit features (reflog, blame, stash, merge-conflict, interactive-rebase, submodule) become inline enhancements to the Meld viewer rather than modal dialogs.
- Configurable list of external diff tools (Meld, KDiff3, Beyond Compare, VS Code, vimdiff) with custom-tool support.
- Phase 1a ships a usable Meld window (read-only) in 1-2 weeks.

### Non-Goals

- Replacing the existing side-by-side diff viewer used in the main commit view (kept for quick "view changes" cases).
- Implementing a full Meld clone (e.g., directory tree diff, in-place rename detection, file copy/merge between panes). Focus on the file-level diff + 3-way merge use cases.
- Plugin system for external tools beyond the simple pre-populated list + custom config.
- Refactoring `app/src/ui/diff/` (deferred to Phase 4 cleanup).
- Real-time collaborative diff viewing.

---

## Module Layout

```
app/src/ui/meld/                        # React UI for the Meld window
├── MeldWindow.tsx                     # Root component
├── MeldToolbar.tsx                    # File filter, mode toggle, external tool dropdown
├── MeldFileTree.tsx                   # File tree sidebar (reuses diff-explorer pattern)
├── MeldDiffPane.tsx                   # Read-only side-by-side diff (Phase 1a)
├── MeldEditorPane.tsx                 # Editable pane (Phase 1b, CodeMirror 6)
├── MeldCharDiff.tsx                   # Character-level word diff (Phase 1b)
├── MeldCopyButtons.tsx                # Copy-left / copy-right arrows (Phase 1b)
├── MeldThreeWayView.tsx               # 3-pane merge (Phase 1c)
├── MeldMergedPane.tsx                 # MERGED pane with conflict markers (Phase 1c)
├── MeldBlameGutter.tsx                # Author per-line gutter (Phase 2)
├── MeldStashView.tsx                  # Stash list as Meld file tree (Phase 2)
├── MeldReflogView.tsx                 # Reflog entry diff (Phase 2)
├── MeldSubmoduleView.tsx              # Submodule diff nodes (Phase 2)
├── MeldRebasePreview.tsx              # Per-commit diff in rebase todo (Phase 3)
├── external-tools/
│   ├── ExternalToolLauncher.tsx       # Spawns configured tool
│   ├── ExternalToolStore.ts           # Persists user-configured tools
│   └── defaultTools.ts                # Pre-populated tool list
├── settings/
│   └── ExternalToolsSettings.tsx      # UI to add/edit/remove tools
└── index.ts                           # Public exports

app/src/lib/meld/                      # Pure logic, no React
├── MeldSession.ts                     # Session state machine
├── diffOperations.ts                  # Diff/merge algorithms
├── externalToolArgs.ts                # Arg-template substitution
└── sessionPersistence.ts              # Window state, recent files

app/src/main-process/meld/             # Main-process side
├── meld-window.ts                     # BrowserWindow lifecycle
├── meld-ipc.ts                        # IPC handlers
└── menu-integration.ts                # Context menu items
```

---

## Data Flow & IPC

### Open flow

1. User right-clicks a file in `app/src/ui/changes/` → context menu item "Open in Meld Window" (or presses `Ctrl+Shift+D` for the currently focused file).
2. Renderer dispatches `dispatcher.openInMeldWindow(repository, filePath, mode?)`.
3. Dispatcher sends IPC `meld:open-window` (renderer→main) with `{ repositoryID, filePath, mode: 'working' | 'commit' | 'merge' }`.
4. Main process (`app/src/main-process/meld/meld-window.ts`):
   - Checks if a Meld window is already open for this repo+file. If yes, focuses it.
   - Otherwise, creates a new BrowserWindow with the Meld entry point, passes the args via `additionalArguments`.
5. Renderer mounts `<MeldWindow>` with the passed args.
6. `componentDidMount` dispatches `getWorkingDirectoryDiff` (or `getCommitDiff`/`getMergeBase` depending on mode) and renders the diff.

### IPC contract

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `meld:open-window` | renderer→main | `{ repositoryID, filePath, mode }` | `{ sessionID }` |
| `meld:close-window` | renderer→main | `{ sessionID }` | — |
| `meld:get-diff` | renderer→main | `{ repositoryID, filePath, mode, ref? }` | `IConcreteDiff` |
| `meld:save-edits` | renderer→main | `{ repositoryID, filePath, contents }` | `{ success, error? }` |
| `meld:save-merge-result` | renderer→main | `{ repositoryID, filePath, contents }` | `{ success, error? }` |
| `meld:launch-external-tool` | renderer→main | `{ toolID, leftPath, rightPath, basePath? }` | `{ success, error? }` |
| `meld:list-tools` | main→renderer | — | `IExternalTool[]` |
| `meld:configure-tool` | renderer→main | `{ tool: IExternalToolConfig }` | `{ success }` |
| `meld:remove-tool` | renderer→main | `{ toolID }` | `{ success }` |
| `meld:list-sessions` | main→renderer | — | `IMeldSession[]` |

### State (added to app-state store)

```typescript
interface IExternalTool {
  readonly id: string
  readonly name: string
  readonly command: string                  // Absolute path or command in PATH
  readonly args: string                     // Template with %L %R %B
  readonly builtIn: boolean                  // True for default tools (not deletable)
}

interface IMeldSession {
  readonly id: string
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: 'working' | 'commit' | 'merge'
  readonly baseRef?: string                  // For commit/merge modes
  readonly diff: IDiff | null
  readonly edits: Map<string, string>        // filePath → edited content (Phase 1b)
  readonly threeWayMerge?: IThreeWayState    // Phase 1c
}
```

---

## Phase 1a — Standalone Meld Window + External Tools (1-2 weeks)

### Files Created

| Path | LOC est. | Purpose |
|------|---------|---------|
| `app/src/ui/meld/MeldWindow.tsx` | 150 | Root component |
| `app/src/ui/meld/MeldToolbar.tsx` | 120 | Filter, mode toggle, external tool dropdown |
| `app/src/ui/meld/MeldFileTree.tsx` | 180 | File tree sidebar |
| `app/src/ui/meld/MeldDiffPane.tsx` | 200 | Read-only diff (reuses SideBySideDiffRow) |
| `app/src/ui/meld/index.ts` | 20 | Public exports |
| `app/src/main-process/meld/meld-window.ts` | 100 | BrowserWindow lifecycle |
| `app/src/main-process/meld/meld-ipc.ts` | 80 | IPC handlers |
| `app/src/main-process/meld/menu-integration.ts` | 50 | Context menu items |
| `app/src/lib/meld/external-tool-args.ts` | 30 | Arg-template substitution |
| `app/src/lib/meld/default-tools.ts` | 50 | Pre-populated tool list |
| `app/src/ui/meld/settings/ExternalToolsSettings.tsx` | 150 | Settings UI |
| `app/src/models/external-tool.ts` | 20 | IExternalTool model |

### Features Shipped

- Standalone BrowserWindow opens from context menu (`Open in Meld Window` on changed files in `app/src/ui/changes/`, on branch context menu for diff vs working tree, on commit context menu for the commit's changes).
- Keyboard shortcut: `Ctrl+Shift+D` (Linux/Windows) / `Cmd+Shift+D` (macOS) opens Meld window for currently focused file.
- File tree sidebar with change indicators (added/modified/deleted/untracked) and file-type icons.
- Read-only side-by-side and unified diff modes (toggle in toolbar).
- Filter modes: Show All / Show Changes / Show Identical / Show Untracked.
- External tool dropdown with 5 pre-populated tools + "Add custom…" → settings panel.
- Each tool's args template uses placeholders: `%L` (left/old path), `%R` (right/new path), `%B` (base path, for 3-way merge).
- Settings persisted in app state (lives next to existing app preferences), accessible from Preferences dialog.
- Window state (size, position) persisted per repository.
- Toolbar shows current repository name and file path.

### Default External Tools

| Name | Command | Args | Notes |
|------|---------|------|-------|
| Meld | `meld` | `%L %R` | Default. `meld` is the canonical Linux diff tool. |
| KDiff3 | `kdiff3` | `%L %R` | Cross-platform 3-way diff. |
| Beyond Compare | `bcompare` | `%L %R` | Commercial. |
| VS Code | `code` | `--diff %L %R` | Common developer choice. |
| vimdiff | `vimdiff` | `%L %R` | Terminal-based. |

### Dispatcher Additions

- `openInMeldWindow(repository, filePath, mode?)` — opens or focuses window.
- `closeMeldWindow(sessionID)` — closes window.
- `saveMeldEdits(sessionID, edits)` — saves edited content (used in Phase 1b).
- `saveMeldMergeResult(sessionID, filePath, contents)` — saves 3-way merge result (Phase 1c).
- `configureExternalTool(tool)` — adds/updates tool config.
- `removeExternalTool(toolID)` — removes tool.
- `listExternalTools()` — returns configured tools.

### Menu Integration

- Right-click on changed file in `app/src/ui/changes/`: add `Open in Meld Window` item.
- Branch context menu: add `Open in Meld Window` for the diff vs working tree.
- History (commit) context menu: add `Open in Meld Window` for the commit's changes.

### Success Criteria

- User can open a file's diff in a standalone window with `Ctrl+Shift+D` or context menu.
- File tree shows all changed files; clicking switches the diff pane.
- Filter modes correctly hide/show identical/unchanged hunks.
- User can launch Meld (or any other configured tool) with both file versions via the toolbar dropdown.
- User can add/edit/remove custom tools via Preferences; changes persist across sessions.
- Window size and position are remembered per repository.

---

## Phase 1b — In-Place Editing + Copy + Char Diff (2-3 weeks)

### Files Created

| Path | LOC est. | Purpose |
|------|---------|---------|
| `app/src/ui/meld/MeldEditorPane.tsx` | 250 | Editable CodeMirror pane (or textarea fallback) |
| `app/src/ui/meld/MeldCharDiff.tsx` | 200 | Character-level word diff |
| `app/src/ui/meld/MeldCopyButtons.tsx` | 80 | Copy-left / copy-right arrows |
| `app/src/lib/meld/diffOperations.ts` | 150 | Pure diff/merge algorithms |
| `app/src/lib/meld/sessionPersistence.ts` | 80 | Persist edits per session |

### Features Shipped

- Each pane in the diff view becomes an editable textarea with monospace font and line numbers.
- (Optional) CodeMirror 6 upgrade for syntax-highlighted editing — evaluated in Phase 1b; if too risky, plain textarea with monospace + line numbers.
- Edit one pane, the other pane updates its char-level diff highlights live (debounced 200ms).
- Save button per pane: writes edited content to disk, stages the file via the existing Git staging.
- Discard edits button: reverts to original.
- Character-level word diff: when a line has a small change, the changed word/character is highlighted red (removed) or green (added) within the surrounding unchanged context.
- Copy-left / copy-right arrows on every changed hunk: copies the changed region from one side to the other (becomes the edit on the other side, with proper indentation preserved).
- Undo / redo per pane (textarea built-in or CodeMirror).
- Search within diff (reuses `diff-search-input.tsx`, integrated with editor).
- Edit conflict detection: warns if file on disk changed since diff was loaded (re-checks git status on save).
- "Reload from disk" button.

### Decision: Textarea vs CodeMirror 6 for editing

The codebase uses CodeMirror 5.65.17 for syntax highlighting (`app/src/ui/diff/syntax-highlighting/`). CodeMirror 6 is a major rewrite with a different API.

- **CodeMirror 5 reuse**: pros — no new dependency, syntax highlighting already integrated. Cons — CM5 is in maintenance mode, no async-friendly editor state.
- **Plain textarea**: pros — zero dependencies, simple, works. Cons — no syntax highlighting in the editable pane.
- **CodeMirror 6 upgrade**: pros — modern, async state, better undo/redo. Cons — large refactor, new dependency, risk of breaking existing diff highlighting.

**Decision**: Use plain `<textarea>` for editing in Phase 1b. Syntax highlighting is read-only via the existing diff layer; the editable pane uses a monospace font and line numbers. If user demand for syntax-highlighted editing is high, revisit CodeMirror 6 in Phase 4.

### Success Criteria

- User can edit either pane; char-level diff highlights update live.
- User can copy a hunk from left to right or right to left with one click.
- User can save the edit; the file is written to disk and staged in git.
- Discard button reverts to the original.
- Undo / redo works.
- File on disk change after diff loaded is detected and user is warned.

---

## Phase 1c — 3-Way Merge View (1-2 weeks)

### Files Created

| Path | LOC est. | Purpose |
|------|---------|---------|
| `app/src/ui/meld/MeldThreeWayView.tsx` | 200 | 3-pane layout (BASE / LOCAL / REMOTE) |
| `app/src/ui/meld/MeldMergedPane.tsx` | 200 | MERGED output pane with conflict markers |

### Features Shipped

- New mode in MeldWindow: "Merge" (visible when current file has unresolved conflicts; detectable via `git status --porcelain`).
- 3-pane layout: BASE (common ancestor) | LOCAL (current branch) | REMOTE (incoming).
- 4th pane: MERGED (user-editable output with `<<<<<<<`, `=======`, `>>>>>>>` markers).
- Click on a conflict hunk in MERGED → highlights the corresponding hunks in BASE/LOCAL/REMOTE.
- "Accept LOCAL" / "Accept REMOTE" buttons per conflict hunk.
- "Use BASE" button (rarely used).
- Auto-merge button: attempts git's `merge-file` algorithm via `git merge-file --ours --theirs --union`; only unresolved conflicts remain.
- "Mark as resolved" button: removes conflict markers, stages the file.
- Integrates with existing `app/src/ui/merge-conflict/merge-conflict-dialog.tsx`: the dialog becomes a launcher; clicking a conflicted file in the dialog opens the Meld window in merge mode.
- "Open in Meld Window" button added to the merge-conflict dialog's per-file action row.

### Success Criteria

- When a file has conflicts, "Merge" mode is selectable in the Meld window.
- 3-way layout shows BASE, LOCAL, REMOTE, MERGED panes.
- User can accept LOCAL or REMOTE per hunk; MERGED updates accordingly.
- Auto-merge button resolves non-conflicting regions automatically.
- "Mark as resolved" writes the merged result to disk with conflict markers removed, stages the file.
- Opening a conflicted file from the existing `merge-conflict-dialog` opens the Meld window in merge mode.

---

## Phase 2 — SmartGit Diff Integrations (2-3 weeks)

### Features Shipped

- **`BlameGutter.tsx`** — left gutter in `MeldDiffPane` showing author + short SHA per line. Hover shows full commit message + date. Click opens that commit's diff in a new Meld window.
- **`MeldStashView.tsx`** — new MeldWindow mode "Stash". File tree shows stashes as expandable nodes (one per stash entry). Click a stash → see its diff as files. Click a file → see the diff.
- **`ReflogWiring`** — in the existing `reflog/reflog-dialog.tsx`, add "Open in Meld" button next to each entry. Clicking opens the Meld window for that commit.
- **`SubmoduleDiff.tsx`** — in `MeldFileTree`, submodules appear as expandable nodes with their own status indicator (clean / modified / uninitialized). Expanding shows the submodule's own diff (via `git diff --submodule`).
- The existing `blame/blame-dialog.tsx`, `stash-manager/stash-manager-dialog.tsx`, `reflog/reflog-dialog.tsx`, `submodule/submodule-dialog.tsx` are kept for backward compat but are deprecated in favor of the Meld-integrated versions.

### Success Criteria

- Blame gutter shows author per line in every diff.
- Stash mode lets user browse and diff any stash.
- Reflog dialog has "Open in Meld" buttons.
- Submodule diffs are visible in the file tree.

---

## Phase 3 — Interactive Rebase Preview (1-2 weeks)

### Features Shipped

- **`MeldRebasePreview.tsx`** — in the existing `interactive-rebase-dialog.tsx`, add a "Preview" column to the todo list. Each commit row has a clickable "View diff" link.
- Clicking "View diff" opens the Meld window (or a side panel in the rebase dialog) showing that commit's diff.
- The preview updates live as the user reorders, squashes, fixups, or drops commits.
- The rebase todo list shows aggregate stats (X insertions, Y deletions) per commit.

### Success Criteria

- Each commit in the rebase todo has a "View diff" button.
- Clicking shows the commit's diff in the Meld window.
- Diff previews update as the user reorders the todo.

---

## Error Handling

- All git operations are async; wrap in try/catch and surface user-friendly errors via the existing toast system.
- If external tool fails to launch (binary not found, exit code non-zero), show toast: `Could not launch "Meld". Check the tool configuration in Preferences.`
- If a Meld window's repository is closed (user removes repo), close the window gracefully with a toast: `Repository was removed; closing Meld window.`
- If user edits conflict markers incorrectly, "Save" validates the result is well-formed (no orphan `<<<<<<<` without `=======` and `>>>>>>>`) before writing.
- If a file in the diff is binary, show a placeholder in the editor pane: "Binary file; use external tool for diff."
- If the diff is too large (>1MB), show a warning and offer to load anyway or use external tool.

## Testing Strategy

Per CLAUDE.md standards:

- **Unit tests (Jest)** in `app/test/unit/meld/`:
  - `diffOperations-test.ts` — pure diff/merge ops, happy path + edge cases
  - `externalToolArgs-test.ts` — arg-template substitution (`%L %R %B`)
  - `sessionPersistence-test.ts` — save/load edits, window state
  - Coverage target: 80% on `app/src/lib/meld/`
- **Component tests (RTL)** in `app/test/unit/ui/meld/`:
  - `MeldWindow-test.tsx` — renders, mounts, dispatches initial action
  - `MeldToolbar-test.tsx` — mode toggle, filter, external tool dropdown
  - `MeldFileTree-test.tsx` — file selection, change indicators
  - `MeldThreeWayView-test.tsx` — 3-pane layout, accept-LOCAL/REMOTE buttons
- **E2E (Playwright)** in `app/test/e2e/`:
  - `meld-basic-flow-test.ts` — open Meld window, select file, view diff
  - `meld-edit-flow-test.ts` — open Meld window, edit, save, verify file on disk changed and staged
  - `meld-external-tool-test.ts` — open Meld window, launch external tool, verify process spawned
  - `meld-merge-flow-test.ts` — open merge conflict, resolve via Meld 3-way, mark as resolved

## Accessibility (WCAG 2.1 AA)

- All interactive elements have `aria-label`.
- Keyboard navigation through hunks: `j`/`k` or `Down`/`Up` arrow keys.
- Copy-left / copy-right keyboard shortcuts: `Alt+Left` / `Alt+Right`.
- Screen reader announces "Copy change from left to right" etc.
- Color-blind safe: don't rely on red/green alone; also use `+`/`-` markers in the gutter.
- Focus indicators visible (3px solid border).
- All toolbars reachable via Tab.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CodeMirror 5 limitations make in-place editing awkward | Medium | Default to plain `<textarea>`; revisit in Phase 4. |
| External tool args templates vary wildly (some use `%1`, some `$1`, some positional) | Medium | Support both `%L/%R/%B` placeholders and `{left}/{right}/{base}` named placeholders. Document the most common patterns. |
| 3-way merge validation is hard; user could create malformed output | Medium | Validate conflict markers before save; show inline error if malformed. |
| Stale diff after file changes on disk | High | Re-check `git status` on save; show warning if file changed since diff was loaded. |
| Submodule diff is complex (different git commands) | Medium | Phase 2 starts with just the status indicator; expand to actual diff later if time permits. |
| BrowserWindow state persistence per repo could grow unbounded | Low | Cap at 10 most-recent repos; drop older states on app quit. |

---

## Open Questions

None at design time. The architectural decisions (B / All of the above / New parallel module / Configurable list / Sub-phased) cover the major axes.

## Approval

Design approved by project owner on 2026-06-05.
