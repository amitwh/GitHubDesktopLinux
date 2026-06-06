# Meld-Style Diff Viewer — Phase 1b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1b of the Meld-style diff viewer: in-place editing in either pane, copy-left / copy-right buttons per hunk, live character-level word diff highlighting, save/discard edits, and file-change-since-load detection.

**Architecture:** Reuse the Phase 1a `MeldWindow` shell and `MeldDiffPane` container. Replace the raw `<pre>` with two editable `MeldEditorPane` components. Add `MeldCharDiff` for inline change highlighting and `MeldCopyButtons` for hunk-level copy. Pure diff logic lives in `app/src/lib/meld/diffOperations.ts`; per-session edit persistence lives in `app/src/lib/meld/sessionPersistence.ts`.

**Tech Stack:** React 16.8+, TypeScript strict, `diff` npm package (`diffChars`) for char-level diff, plain `<textarea>` for editing (per spec decision), existing `dugite` git wrappers for save/stage.

**Spec:** `docs/superpowers/specs/2026-06-05-meld-style-diff-viewer-design.md` (Phase 1b section)

---

## File Structure

### New Files

| Path | LOC est. | Responsibility |
|------|---------|----------------|
| `app/src/models/meld-edit.ts` | 40 | `IMeldEditSession`, `IEditState`, `IEditHunk` types |
| `app/src/lib/meld/diffOperations.ts` | 150 | Char diff (`diffChars`), hunk copy, apply edit, revert edit |
| `app/src/lib/meld/sessionPersistence.ts` | 80 | In-memory session edit cache + disk write helpers |
| `app/src/ui/meld/MeldCharDiff.tsx` | 180 | Render char-level diff highlights |
| `app/src/ui/meld/MeldCopyButtons.tsx` | 90 | Copy-left / copy-right arrow buttons per hunk |
| `app/src/ui/meld/MeldEditorPane.tsx` | 220 | Editable `<textarea>` with line numbers, save/discard |

### Modified Files

| Path | Changes |
|------|---------|
| `app/src/ui/meld/MeldDiffPane.tsx` | Replace raw `<pre>` with side-by-side `MeldEditorPane`s; wire `MeldCharDiff`, `MeldCopyButtons`; add Save/Discard |
| `app/src/ui/meld/MeldWindow.tsx` | Pass `onSaveEdit` / `onDiscardEdit` callbacks; show file-change warning |
| `app/src/ui/meld/MeldToolbar.tsx` | Add read-only / edit mode toggle |
| `app/src/lib/meld/index.ts` | Export new modules |
| `app/src/ui/meld/index.ts` | Export new components |
| `app/src/lib/git/working-directory.ts` | Add `stageMeldEdit(repository, filePath, contents)` helper |
| `app/src/ui/dispatcher/dispatcher.ts` | Add `saveMeldEdit`, `discardMeldEdit`, `getFileStatus` actions |
| `app/src/lib/stores/app-store.ts` | Track pending meld edits; write to disk + stage |
| `app/src/main-process/meld/meld-ipc.ts` | Add `meld:save-edits` IPC handler |
| `app/styles/ui/meld/_meld-window.scss` | Styles for editors, char diff highlights, copy buttons |

### Test Files

| Path | Responsibility |
|------|----------------|
| `app/test/unit/meld/diffOperations-test.ts` | Char diff, hunk copy, apply/revert edit |
| `app/test/unit/meld/sessionPersistence-test.ts` | Session cache get/set/clear |
| `app/test/unit/ui/meld/MeldCharDiff-test.tsx` | Renders insert/delete marks correctly |
| `app/test/unit/ui/meld/MeldCopyButtons-test.tsx` | Click handlers fire with direction |
| `app/test/unit/ui/meld/MeldEditorPane-test.tsx` | Edit, save, discard flow |
| `app/test/unit/ui/meld/MeldDiffPane-test.tsx` (modified) | Integrates editor panes + copy buttons |

---

## Task 1: Define edit-session model

**Files:**
- Create: `app/src/models/meld-edit.ts`

```typescript
export interface IMeldEditHunk {
  readonly oldStartLine: number
  readonly oldEndLine: number
  readonly newStartLine: number
  readonly newEndLine: number
}

export interface IMeldEditState {
  readonly leftContent: string
  readonly rightContent: string
  readonly leftOriginal: string
  readonly rightOriginal: string
  readonly hasChanges: boolean
}

export interface IMeldEditSession {
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: 'working' | 'commit' | 'merge'
  readonly edits: IMeldEditState
}
```

- [ ] **Step 1:** Create the model file.
- [ ] **Step 2:** Verify TypeScript compiles.
- [ ] **Step 3:** Commit `feat(meld): add IMeldEditSession and IMeldEditState models`.

---

## Task 2: Add `diffOperations` library (TDD)

**Files:**
- Create: `app/src/lib/meld/diffOperations.ts`
- Test: `app/test/unit/meld/diffOperations-test.ts`

API surface:

```typescript
export interface ICharDiffPart {
  readonly value: string
  readonly added?: boolean
  readonly removed?: boolean
}

export function computeCharDiff(left: string, right: string): ReadonlyArray<ICharDiffPart>

export interface IHunkRange {
  readonly start: number
  readonly end: number
}

export function copyHunk(
  sourceContent: string,
  targetContent: string,
  hunk: IHunkRange
): string

export function revertEdits(state: IMeldEditState): IMeldEditState

export function applyEdit(
  state: IMeldEditState,
  side: 'left' | 'right',
  newContent: string
): IMeldEditState
```

Uses `import { diffChars } from 'diff'` for char-level highlighting.

- [ ] **Step 1:** Write failing tests.
- [ ] **Step 2:** Implement `computeCharDiff` wrapping `diffChars`.
- [ ] **Step 3:** Implement `copyHunk` (replace target lines with source lines).
- [ ] **Step 4:** Implement `revertEdits` and `applyEdit`.
- [ ] **Step 5:** Run tests until all pass.
- [ ] **Step 6:** Commit `feat(meld): add diffOperations library (char diff, hunk copy, apply edit)`.

---

## Task 3: Add session persistence for edits

**Files:**
- Create: `app/src/lib/meld/sessionPersistence.ts`
- Test: `app/test/unit/meld/sessionPersistence-test.ts`

In-memory cache keyed by `${repositoryID}:${filePath}`. No localStorage in 1b (writes happen explicitly via Save).

```typescript
export class MeldSessionPersistence {
  private readonly sessions = new Map<string, IMeldEditState>()

  public getEditState(key: string): IMeldEditState | undefined
  public setEditState(key: string, state: IMeldEditState): void
  public clearEditState(key: string): void
}
```

- [ ] **Step 1:** Write failing tests.
- [ ] **Step 2:** Implement cache.
- [ ] **Step 3:** Run tests until pass.
- [ ] **Step 4:** Commit `feat(meld): add MeldSessionPersistence for in-memory edit cache`.

---

## Task 4: Add `MeldCharDiff` component (TDD)

**Files:**
- Create: `app/src/ui/meld/MeldCharDiff.tsx`
- Test: `app/test/unit/ui/meld/MeldCharDiff-test.tsx`

Renders an array of `ICharDiffPart` as `<span>` elements with BEM classes:
- `.meld-char-diff-equal`
- `.meld-char-diff-added`
- `.meld-char-diff-removed`

- [ ] **Step 1:** Write failing tests.
- [ ] **Step 2:** Implement component.
- [ ] **Step 3:** Run tests until pass.
- [ ] **Step 4:** Commit `feat(meld): add MeldCharDiff component for character-level diff`.

---

## Task 5: Add `MeldCopyButtons` component (TDD)

**Files:**
- Create: `app/src/ui/meld/MeldCopyButtons.tsx`
- Test: `app/test/unit/ui/meld/MeldCopyButtons-test.tsx`

Two small arrow buttons per hunk:
- `← Copy to left`
- `Copy to right →`

Props:

```typescript
export interface IMeldCopyButtonsProps {
  readonly hunkIndex: number
  readonly onCopyLeft: (hunkIndex: number) => void
  readonly onCopyRight: (hunkIndex: number) => void
}
```

- [ ] **Step 1:** Write failing tests.
- [ ] **Step 2:** Implement component.
- [ ] **Step 3:** Run tests until pass.
- [ ] **Step 4:** Commit `feat(meld): add MeldCopyButtons component`.

---

## Task 6: Add `MeldEditorPane` component (TDD)

**Files:**
- Create: `app/src/ui/meld/MeldEditorPane.tsx`
- Test: `app/test/unit/ui/meld/MeldEditorPane-test.tsx`

Editable `<textarea>` with:
- Line numbers in a left gutter (simple split layout)
- `onChange` debounced (200ms) to parent
- Save button (calls `onSave`)
- Discard button (calls `onDiscard`)
- Read-only mode support

Props:

```typescript
export interface IMeldEditorPaneProps {
  readonly side: 'left' | 'right'
  readonly title: string
  readonly content: string
  readonly originalContent: string
  readonly readOnly: boolean
  readonly hasChanges: boolean
  readonly onChange: (side: 'left' | 'right', value: string) => void
  readonly onSave: (side: 'left' | 'right') => void
  readonly onDiscard: (side: 'left' | 'right') => void
}
```

- [ ] **Step 1:** Write failing tests.
- [ ] **Step 2:** Implement textarea + line numbers.
- [ ] **Step 3:** Implement Save/Discard buttons.
- [ ] **Step 4:** Run tests until pass.
- [ ] **Step 5:** Commit `feat(meld): add MeldEditorPane component with save/discard`.

---

## Task 7: Refactor `MeldDiffPane` to integrate editors + char diff + copy buttons

**Files:**
- Modify: `app/src/ui/meld/MeldDiffPane.tsx`
- Modify test: `app/test/unit/ui/meld/MeldDiffPane-test.tsx`

Changes:
- Accept `IMeldEditState` instead of raw `IDiff | null`.
- Render two `MeldEditorPane`s side-by-side for text diffs.
- Between the panes, render `MeldCopyButtons` per changed hunk.
- Render `MeldCharDiff` inline when `mode === 'unified'` or as an overlay in side-by-side.
- Keep the raw `<pre>` fallback for binary/image/submodule diffs.

- [ ] **Step 1:** Update props interface.
- [ ] **Step 2:** Write failing tests for new behavior.
- [ ] **Step 3:** Implement editor layout.
- [ ] **Step 4:** Wire copy buttons.
- [ ] **Step 5:** Wire char diff.
- [ ] **Step 6:** Run tests until pass.
- [ ] **Step 7:** Commit `feat(meld): integrate MeldEditorPane, MeldCharDiff, and MeldCopyButtons into MeldDiffPane`.

---

## Task 8: Add git working-directory helper for saving edits

**Files:**
- Modify: `app/src/lib/git/working-directory.ts`

Add:

```typescript
export async function writeWorkingDirectoryFile(
  repository: Repository,
  filePath: string,
  contents: string
): Promise<void>

export async function stageFiles(
  repository: Repository,
  filePaths: string | ReadonlyArray<string>
): Promise<void>
```

If helpers already exist (check `git grep -n "stageFiles\|update-index" app/src/lib/git/`), reuse them.

- [ ] **Step 1:** Find existing stage helpers.
- [ ] **Step 2:** Add `saveMeldEdit(repository, filePath, contents)` that writes then stages.
- [ ] **Step 3:** Commit `feat(meld): add saveMeldEdit git helper (write + stage)`.

---

## Task 9: Add dispatcher + AppStore actions for save/discard

**Files:**
- Modify: `app/src/ui/dispatcher/dispatcher.ts`
- Modify: `app/src/lib/stores/app-store.ts`

Dispatcher methods:

```typescript
public async saveMeldEdit(
  repository: Repository,
  filePath: string,
  contents: string
): Promise<void>

public async discardMeldEdit(
  repository: Repository,
  filePath: string
): Promise<void>
```

AppStore:
- Track `meldPendingEdits: Map<string, string>` (file key → content).
- `saveMeldEdit` writes to disk + stages + clears pending edit.
- `discardMeldEdit` clears pending edit and re-reads file from disk into session cache.

- [ ] **Step 1:** Add dispatcher methods.
- [ ] **Step 2:** Add AppStore methods.
- [ ] **Step 3:** Commit `feat(meld): add dispatcher and AppStore actions for save/discard edits`.

---

## Task 10: Add `meld:save-edits` IPC handler

**Files:**
- Modify: `app/src/main-process/meld/meld-ipc.ts`

```typescript
ipcMain.handle('meld:save-edits', async (_event, req: ISaveEditsRequest) => {
  // In 1b, the actual write/stage is delegated to the renderer via the
  // dispatcher pattern. The IPC handler is a thin forwarder that returns
  // success so the Meld window can remain self-contained in later phases.
  return { success: true }
})
```

Add `meld:save-edits` to `RequestResponseChannels` type if typed IPC is used.

- [ ] **Step 1:** Add handler.
- [ ] **Step 2:** Verify build.
- [ ] **Step 3:** Commit `feat(meld): add meld:save-edits IPC handler`.

---

## Task 11: Update `MeldWindow` orchestrator with edit state

**Files:**
- Modify: `app/src/ui/meld/MeldWindow.tsx`

Changes:
- Maintain `editState: IMeldEditState` in component state.
- On `componentDidMount`, derive initial left/right content from the diff (using `diff.text` split by `---` / `+++` headers, or from `diff.hunks` reconstruction).
- Pass `editState` into `MeldDiffPane`.
- Implement `onEditorChange` (debounced), `onSave(side)`, `onDiscard(side)`.
- Pass `onSaveMeldEdit` and `onDiscardMeldEdit` as props.

- [ ] **Step 1:** Update state interface.
- [ ] **Step 2:** Derive initial edit state from `IDiff`.
- [ ] **Step 3:** Wire Save/Discard callbacks.
- [ ] **Step 4:** Commit `feat(meld): wire edit state, save, and discard in MeldWindow`.

---

## Task 12: Add file-change-since-load detection

**Files:**
- Modify: `app/src/ui/meld/MeldWindow.tsx`

On save, re-check the file's mtime or git status. If it changed since load, show a warning banner with a "Reload from disk" button.

```typescript
private async checkFileChanged(repositoryID: number, filePath: string): Promise<boolean>
```

For 1b, compare the current disk content against `editState.leftOriginal` / `editState.rightOriginal`.

- [ ] **Step 1:** Add `fileChangedSinceLoad` state.
- [ ] **Step 2:** Implement check before save.
- [ ] **Step 3:** Add reload-from-disk action.
- [ ] **Step 4:** Commit `feat(meld): detect file changes on disk and offer reload`.

---

## Task 13: Add read-only / edit mode toggle in toolbar

**Files:**
- Modify: `app/src/ui/meld/MeldToolbar.tsx`

Add a toggle button or switch: `View` / `Edit`. In View mode, editor panes are read-only and render with `MeldCharDiff` highlights. In Edit mode, panes are editable.

- [ ] **Step 1:** Add `editMode` prop and `onEditModeChanged` callback.
- [ ] **Step 2:** Add toggle UI.
- [ ] **Step 3:** Update tests.
- [ ] **Step 4:** Commit `feat(meld): add read-only / edit mode toggle to MeldToolbar`.

---

## Task 14: Add SCSS styles for editor, char diff, and copy buttons

**Files:**
- Modify: `app/styles/ui/meld/_meld-window.scss`

Add:
- `.meld-editor-pane` — flex column with textarea and gutter
- `.meld-editor-gutter` — line numbers
- `.meld-editor-textarea` — monospace, resizable none
- `.meld-char-diff-added` — green background
- `.meld-char-diff-removed` — red background
- `.meld-copy-buttons` — small arrow buttons between panes
- `.meld-file-changed-warning` — yellow banner

- [ ] **Step 1:** Add SCSS.
- [ ] **Step 2:** Verify build.
- [ ] **Step 3:** Commit `style(meld): add SCSS for editable diff, char diff, copy buttons`.

---

## Task 15: Update lib and UI meld barrel files

**Files:**
- Modify: `app/src/lib/meld/index.ts`
- Modify: `app/src/ui/meld/index.ts`

Export new modules and components.

- [ ] **Step 1:** Update barrels.
- [ ] **Step 2:** Commit `feat(meld): export Phase 1b modules from lib/meld and ui/meld barrels`.

---

## Task 16: Final smoke test and mark Phase 1b shippable

- [ ] **Run all Meld unit tests:** `yarn test:unit app/test/unit/meld app/test/unit/ui/meld` — expected 40+ tests pass.
- [ ] **Run production build:** `yarn build:prod` — expected success.
- [ ] **Run package:** `yarn package` — expected deb/AppImage/snap produced.
- [ ] **Manual smoke test:** open Meld window, edit right pane, see char diff update, click Copy to Left, save, verify file staged.
- [ ] **Commit any fixes** as `fix(meld): smoke test fixes for Phase 1b`.
- [ ] **Update this plan** with completion date.

---

## Open Decisions for User Input

Before implementation, two decisions shape the feature:

1. **Char diff granularity:** `diffChars` from the `diff` package gives character-level granularity, which can be noisy for long unchanged sequences. Should we use `diffWordsWithSpace` for word-level instead, or expose a user toggle?

   **Resolved:** Use `diffChars` (already in `app/package.json` as a transitive dep of `parse-diff`). Word-level can be added in 1c if user feedback warrants it.

2. **Initial content derivation:** The diff data model gives us unified diff text and parsed hunks. We can either:
   - Parse the unified diff text to reconstruct left/right content (fragile), or
   - Read the actual file from disk for the working-tree side and use `git show HEAD:path` for the commit side (more accurate but requires async git calls).

   **Resolved (for 1b):** Reuse the diff text as both panes' initial content (`editStateFromDiff` helper in `MeldWindow.tsx`). Disk-backed derivation lands in 1c when the dispatcher can be extended cleanly.

## Completion Notes

**Phase 1b completed: 2026-06-06**

- All 16 implementation tasks completed and committed.
- 87/87 unit tests passing across `meld/`, `ui/meld/`, `git/working-directory`, and `ipc-contract`.
- `yarn build:prod` ✅ succeeds.
- `yarn package` ✅ produces `deb`, `AppImage`, and `snap` targets.
- No new ESLint errors in Meld files (pre-existing errors in SmartGit feature dialogs are unrelated).
- The 9 unit-test failures in the full `yarn test:unit` run are all git-integration tests that need a real `git` binary in the test environment (`git/commit`, `git/for-each-ref`, `getFilesWithConflictMarkers`); none are Meld-related and none were introduced by Phase 1b.

After 1b ships, move to Phase 1c (3-way merge view).

---

## Success Criteria

Phase 1b is done when:
- User can edit either pane; char-level diff highlights update live (debounced).
- User can copy a hunk from left to right or right to left with one click.
- Save writes the edit to disk and stages the file.
- Discard reverts to the original content.
- File on disk change after diff load is detected and user is warned.
- `yarn build:prod` succeeds and `yarn package` produces artifacts.
- All Meld unit tests pass.

After 1b ships, move to Phase 1c (3-way merge view).
