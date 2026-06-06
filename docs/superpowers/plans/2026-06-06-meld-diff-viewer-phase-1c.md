# Meld-Style Diff Viewer — Phase 1c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1c of the Meld-style diff viewer: a 3-way merge view (BASE / LOCAL / REMOTE) with a user-editable MERGED pane, per-hunk "Accept LOCAL / Accept REMOTE / Use BASE" actions, auto-merge via `git merge-file --union`, and a "Mark as resolved" action that stages the result. Wire the existing `merge-conflict-dialog.tsx` to launch the Meld window in merge mode.

**Architecture:** The 1a/1b `MeldWindow` shell is reused with a new `mode: 'merge'` prop. Inside, the single editor layout is replaced by `MeldThreeWayView` (3 read-only panes) plus `MeldMergedPane` (the editable output). Pure conflict-marker parsing/synthesis lives in `app/src/lib/meld/conflictMarkers.ts`. The git-side helpers live in `app/src/lib/git/merge-file.ts` (auto-merge via `git merge-file`) and a new `app/src/lib/git/three-way-resolve.ts` (read BASE, LOCAL, REMOTE). The `merge-conflict-dialog.tsx` becomes a thin launcher that calls `dispatcher.openInMeldWindow(..., mode: 'merge')`.

**Tech Stack:** React 16.8+, TypeScript strict, Node's `child_process.spawn` (or `git` helper from `app/src/lib/git/core`) for `git merge-file`, existing `getBlobContents` and `getMergeBase` helpers, jest-style `node:test`.

**Spec:** `docs/superpowers/specs/2026-06-05-meld-style-diff-viewer-design.md` (Phase 1c section)

**Depends on:** Phase 1a (Meld window shell), Phase 1b (editing + char diff). Both are merged on the `linux` branch.

---

## File Structure

### New Files

| Path | LOC est. | Responsibility |
|------|---------|----------------|
| `app/src/lib/meld/conflictMarkers.ts` | 180 | Parse/synthesize git conflict markers; build MERGED from accept-local/remote/base |
| `app/src/lib/git/merge-file.ts` | 90 | Wrapper around `git merge-file --ours --theirs --union` |
| `app/src/lib/git/three-way-resolve.ts` | 120 | Read BASE / LOCAL / REMOTE content for a conflicted file path |
| `app/src/models/meld-merge.ts` | 80 | `IThreeWayState`, `IConflictHunk`, `IMergedFile` types |
| `app/src/ui/meld/MeldThreeWayView.tsx` | 250 | 3-pane read-only layout (BASE / LOCAL / REMOTE) with click-to-highlight |
| `app/src/ui/meld/MeldMergedPane.tsx` | 280 | Editable MERGED pane with conflict-marker highlights + per-hunk action buttons |
| `app/src/ui/meld/MeldMergeControls.tsx` | 150 | Auto-merge + Mark as resolved buttons |
| `app/test/unit/meld/conflictMarkers-test.ts` | 180 | parseConflictMarkers, synthesizeMerge, buildConflictHunks |
| `app/test/unit/git/merge-file-test.ts` | 80 | parseMergeFileResult, basic invocation |
| `app/test/unit/ui/meld/MeldThreeWayView-test.tsx` | 80 | Renders 3 panes, click highlights |
| `app/test/unit/ui/meld/MeldMergedPane-test.tsx` | 100 | Per-hunk accept actions, click handlers |
| `app/test/e2e/meld/meld-merge-flow-test.ts` | 140 | Open merge conflict, resolve via Meld 3-way, mark as resolved |

### Modified Files

| Path | Changes |
|------|---------|
| `app/src/lib/app-state.ts` | Add `IThreeWayState` to `IMeldSession` |
| `app/src/lib/stores/app-store.ts` | Add `_getThreeWayState`, `_setThreeWayState` methods |
| `app/src/ui/dispatcher/dispatcher.ts` | Add `openInMeldWindowMergeMode`, `getThreeWayState`, `autoMergeThreeWay`, `markMergeResolved`, `launchExternalToolForMerge` |
| `app/src/ui/meld/MeldWindow.tsx` | Add `mode: 'merge'` to `IMeldWindowProps`; route to `MeldThreeWayView` + `MeldMergedPane` when merge |
| `app/src/ui/meld/index.ts` | Export new components and types |
| `app/src/main-process/meld/meld-ipc.ts` | Add `meld:open-window` to accept `mode: 'merge'`; add `meld:auto-merge` channel |
| `app/src/main-process/meld/meld-window.ts` | Extend `openMeldWindow` to accept a 3-way state; load BASE/LOCAL/REMOTE before opening |
| `app/src/ui/merge-conflict/merge-conflict-dialog.tsx` | Add "Open in Meld Window" button per file row that calls `dispatcher.openInMeldWindowMergeMode` |
| `app/src/lib/ipc-shared.ts` | Add `meld:auto-merge` channel to `RequestResponseChannels` |
| `app/test/unit/ipc-contract-test.ts` | Add `'meld:auto-merge'` to `expectedResponseChannels` |
| `app/styles/ui/meld/_meld-window.scss` | Styles for 4-pane layout, conflict-marker highlights, per-hunk action bar |

---

## Task 1: Define three-way merge models

**Files:**
- Create: `app/src/models/meld-merge.ts`

```typescript
/**
 * A single conflict block parsed from a git-style conflict-marker
 * region. `baseContent` is the common-ancestor text; `localContent`
 * and `remoteContent` are the two competing edits.
 */
export interface IConflictHunk {
  readonly baseContent: string
  readonly localContent: string
  readonly remoteContent: string
  /** 0-indexed line number in the MERGED file where the hunk starts. */
  readonly startLine: number
  /** Inclusive end line of the hunk (the line of `>>>>>>> ...`). */
  readonly endLine: number
}

/**
 * A three-way merge state for one (repository, file) pair. The three
 * sides are the BASE / LOCAL / REMOTE text; the `hunks` array lists
 * the unresolved conflict blocks within the MERGED file.
 */
export interface IThreeWayState {
  readonly repositoryID: number
  readonly filePath: string
  readonly baseContent: string
  readonly localContent: string
  readonly remoteContent: string
  readonly mergedContent: string
  readonly hunks: ReadonlyArray<IConflictHunk>
}

/**
 * Extend the existing IMeldSession with a 3-way state slot. When
 * the session is in merge mode, `mode === 'merge'` and `threeWay`
 * is populated.
 */
export interface IMeldSessionMerge {
  readonly id: string
  readonly repositoryID: number
  readonly filePath: string
  readonly mode: 'merge'
  readonly threeWay: IThreeWayState
}
```

- [ ] **Step 1:** Create the model file.
- [ ] **Step 2:** Run `yarn build:dev 2>&1 | tail -3` and confirm success.
- [ ] **Step 3:** Commit `feat(meld): add IThreeWayState and IConflictHunk models`.

---

## Task 2: Add `conflictMarkers` library (TDD)

**Files:**
- Create: `app/src/lib/meld/conflictMarkers.ts`
- Test: `app/test/unit/meld/conflictMarkers-test.ts`

API:

```typescript
/** Parse a MERGED file into alternating "context" and "conflict" regions. */
export function parseConflictMarkers(
  merged: string
): ReadonlyArray<
  | { readonly kind: 'context'; readonly content: string; readonly startLine: number; readonly endLine: number }
  | { readonly kind: 'conflict'; readonly hunk: IConflictHunk }
>

/** Build a MERGED file from a list of regions. Inverse of parseConflictMarkers. */
export function synthesizeMerge(
  regions: ReadonlyArray<
    | { readonly kind: 'context'; readonly content: string }
    | { readonly kind: 'conflict'; readonly hunk: IConflictHunk }
  >
): string

/**
 * Re-render a single hunk inside a MERGED file. The new hunk may
 * have empty `baseContent` (use-BASE = local), `localContent`
 * (accept LOCAL) or `remoteContent` (accept REMOTE), depending on
 * `side`.
 */
export function applyHunkResolution(
  merged: string,
  hunkIndex: number,
  side: 'base' | 'local' | 'remote'
): string

/**
 * Locate all conflict regions in `merged` and return them in source
 * order. Used by MeldMergedPane to render per-hunk action bars.
 */
export function buildConflictHunks(
  merged: string
): ReadonlyArray<IConflictHunk>
```

- [ ] **Step 1:** Write failing tests in `app/test/unit/meld/conflictMarkers-test.ts` covering:
  - `parseConflictMarkers` on text with no markers → 1 context region
  - `parseConflictMarkers` on text with 2 conflict regions → 3 context + 2 conflict
  - `synthesizeMerge` round-trips with `parseConflictMarkers`
  - `applyHunkResolution` with `side: 'local'` replaces the conflict with `localContent`
  - `applyHunkResolution` with `side: 'base'` replaces with empty (or `baseContent` if non-empty)
  - `applyHunkResolution` with `side: 'remote'` replaces with `remoteContent`
  - `buildConflictHunks` returns one entry per `<<<<<<<` marker
- [ ] **Step 2:** Run the test file and confirm all assertions fail.
- [ ] **Step 3:** Implement the four functions. Use a single pass over the text tracking `<<<<<<<` / `=======` / `|||||||` / `>>>>>>>` markers. The four-marker variant (with `||||||| base`) is git's default; treat the three-marker variant (no base) as `baseContent === ''`.
- [ ] **Step 4:** Re-run the tests and confirm they all pass.
- [ ] **Step 5:** Commit `feat(meld): add conflictMarkers library (parse, synthesize, apply resolution)`.

---

## Task 3: Add `merge-file` git helper (TDD)

**Files:**
- Create: `app/src/lib/git/merge-file.ts`
- Test: `app/test/unit/git/merge-file-test.ts`

API:

```typescript
export interface IGitMergeFileResult {
  /** The merged content (with conflict markers if any conflicts). */
  readonly mergedContent: string
  /** True when no conflict markers remain in the merged output. */
  readonly clean: boolean
  /** Conflict count, 0 when clean. */
  readonly conflictCount: number
}

export async function gitMergeFile(
  repository: Repository,
  currentPath: string,
  oursPath: string,
  theirsPath: string
): Promise<IGitMergeFileResult>
```

We invoke `git merge-file --ours <currentPath> --theirs <theirsPath>` after writing BASE/OURS/THEIRS to temp files inside the repository's working dir (so git can resolve the paths). The `git merge-file` exit code is 0 (clean), 1 (conflicts), or -1 (error).

- [ ] **Step 1:** Write failing tests covering:
  - `parseMergeFileResult` parses a clean merge exit (0) with no markers as `{ clean: true, conflictCount: 0 }`
  - `parseMergeFileResult` parses exit code 1 with `<<<<<<<` markers in output as `{ clean: false, conflictCount: 1 }`
  - `parseMergeFileResult` parses exit code 1 with two `<<<<<<<` regions as `{ clean: false, conflictCount: 2 }`
- [ ] **Step 2:** Run the test file and confirm failures.
- [ ] **Step 3:** Implement `parseMergeFileResult` (pure parser) and `gitMergeFile` (writes temp files, calls `git merge-file`, cleans up, returns parsed result).
- [ ] **Step 4:** Re-run tests and confirm pass.
- [ ] **Step 5:** Commit `feat(meld): add gitMergeFile helper (auto-merge via git merge-file)`.

---

## Task 4: Add `three-way-resolve` git helper

**Files:**
- Create: `app/src/lib/git/three-way-resolve.ts`
- Test: `app/test/unit/git/three-way-resolve-test.ts`

API:

```typescript
export interface IThreeWayContents {
  /** Common-ancestor content (empty string if the file was added in both branches). */
  readonly baseContent: string
  /** The current branch's version (read from the working tree). */
  readonly localContent: string
  /** The incoming branch's version (read via `git show <theirs>:<path>`). */
  readonly remoteContent: string
}

/**
 * Read the three sides of a merge conflict for `filePath`. The caller
 * supplies the SHA of the common ancestor and the SHA of the
 * incoming branch tip.
 */
export async function readThreeWayContents(
  repository: Repository,
  filePath: string,
  mergeBaseSha: string,
  theirsSha: string
): Promise<IThreeWayContents>
```

- [ ] **Step 1:** Write failing tests:
  - `readThreeWayContents` reads BASE via `git show <base>:<path>` and decodes as utf8
  - `readThreeWayContents` reads LOCAL from `<repo.path>/<path>` (the working tree)
  - `readThreeWayContents` reads REMOTE via `git show <theirs>:<path>` and decodes as utf8
  - When a file was added in only one branch, BASE is empty string (not undefined)
- [ ] **Step 2:** Run the test file and confirm failures.
- [ ] **Step 3:** Implement the helper. Reuse `getBlobContents` (returns a Buffer) for the git show reads; pipe through `coerceToString` to decode as utf8. Use `readWorkingDirectoryFile` (added in 1b) for LOCAL.
- [ ] **Step 4:** Re-run tests and confirm pass.
- [ ] **Step 5:** Commit `feat(meld): add readThreeWayContents helper (BASE / LOCAL / REMOTE)`.

---

## Task 5: Add dispatcher + AppStore actions for 3-way merge

**Files:**
- Modify: `app/src/ui/dispatcher/dispatcher.ts`
- Modify: `app/src/lib/stores/app-store.ts`

Dispatcher methods:

```typescript
public async openInMeldWindowMergeMode(
  repository: Repository,
  filePath: string
): Promise<void> {
  await this.emitter.emit('open-in-meld-window-merge', repository, filePath)
}

public async getThreeWayState(
  repository: Repository,
  filePath: string
): Promise<IThreeWayState> {
  // Resolve merge-base and theirs via the existing getMergeBase + getCurrentBranch
  // helpers, then call readThreeWayContents.
  // ...
}

public async autoMergeThreeWay(
  repository: Repository,
  filePath: string
): Promise<{ mergedContent: string; clean: boolean }> {
  // Write BASE/OURS/THEIRS to temp files; call gitMergeFile; return result.
}

public async markMergeResolved(
  repository: Repository,
  filePath: string,
  mergedContent: string
): Promise<{ success: boolean; error?: string }> {
  // Call writeWorkingDirectoryFile (1b) + addConflictedFile (existing)
  // + clear any pending edit.
}
```

AppStore:

```typescript
private threeWayStates = new Map<string, IThreeWayState>()

public _setThreeWayState(key: string, state: IThreeWayState): void {
  this.threeWayStates.set(key, state)
  this.emitUpdate()
}

public _getThreeWayState(key: string): IThreeWayState | undefined {
  return this.threeWayStates.get(key)
}
```

- [ ] **Step 1:** Add the four dispatcher methods. The `getThreeWayState` call chain: `getCurrentBranch(repo) → getMergeBase(repo, ours, theirs) → readThreeWayContents(...) → buildConflictHunks(mergedContent) → return IThreeWayState`.
- [ ] **Step 2:** Add the two AppStore methods. Add `meldThreeWayStates: ReadonlyMap<string, IThreeWayState>` to `IAppState` and the initializer.
- [ ] **Step 3:** Run `yarn build:dev 2>&1 | tail -3` and confirm success.
- [ ] **Step 4:** Commit `feat(meld): add dispatcher and AppStore actions for 3-way merge`.

---

## Task 6: Add `MeldThreeWayView` component (TDD)

**Files:**
- Create: `app/src/ui/meld/MeldThreeWayView.tsx`
- Test: `app/test/unit/ui/meld/MeldThreeWayView-test.tsx`

Renders three read-only `<pre>` panes (BASE / LOCAL / REMOTE) with line numbers. Click on a hunk in any pane highlights the same line range in the other two. Props:

```typescript
export interface IMeldThreeWayViewProps {
  readonly baseContent: string
  readonly localContent: string
  readonly remoteContent: string
  readonly activeHunk: IConflictHunk | null
  readonly onHunkClicked?: (hunk: IConflictHunk) => void
}
```

The component computes hunks from `baseContent` (any region that differs between base/local or base/remote is a candidate hunk) and groups consecutive differing lines into one hunk per side.

- [ ] **Step 1:** Write failing tests:
  - Renders the BASE / LOCAL / REMOTE labels
  - Renders the three contents in separate `<pre>` panes
  - When `activeHunk` is set, the matching line range gets a `data-active="true"` attribute
  - Clicking a hunk row calls `onHunkClicked` with the hunk
- [ ] **Step 2:** Run tests and confirm failure.
- [ ] **Step 3:** Implement the component. Use a simple "find common subsequences" by line: walk three line arrays, mark lines that differ as "in hunk", and group consecutive hunk lines into `IConflictHunk` records.
- [ ] **Step 4:** Re-run tests and confirm pass.
- [ ] **Step 5:** Commit `feat(meld): add MeldThreeWayView component (BASE / LOCAL / REMOTE panes)`.

---

## Task 7: Add `MeldMergedPane` component (TDD)

**Files:**
- Create: `app/src/ui/meld/MeldMergedPane.tsx`
- Test: `app/test/unit/ui/meld/MeldMergedPane-test.tsx`

Editable pane showing the MERGED content with conflict-marker highlights. Each unresolved conflict gets a per-hunk action bar with three buttons: "Accept LOCAL", "Accept REMOTE", "Use BASE". Props:

```typescript
export interface IMeldMergedPaneProps {
  readonly content: string
  readonly hunks: ReadonlyArray<IConflictHunk>
  readonly readOnly: boolean
  readonly onContentChange: (content: string) => void
  readonly onHunkResolved: (
    hunkIndex: number,
    side: 'base' | 'local' | 'remote'
  ) => void
}
```

- [ ] **Step 1:** Write failing tests:
  - Renders the merged content
  - Renders one action bar per hunk with three buttons each
  - Clicking "Accept LOCAL" calls `onHunkResolved(idx, 'local')`
  - Clicking "Accept REMOTE" calls `onHunkResolved(idx, 'remote')`
  - Clicking "Use BASE" calls `onHunkResolved(idx, 'base')`
  - Editing the textarea calls `onContentChange`
- [ ] **Step 2:** Run tests and confirm failure.
- [ ] **Step 3:** Implement. Use the existing `MeldEditorPane` for the textarea (1b) but render the action bars as siblings between conflict regions. Or, for tighter coupling, render a single textarea with absolute-positioned action bars.
- [ ] **Step 4:** Re-run tests and confirm pass.
- [ ] **Step 5:** Commit `feat(meld): add MeldMergedPane component (editable merge output with per-hunk actions)`.

---

## Task 8: Add `MeldMergeControls` component

**Files:**
- Create: `app/src/ui/meld/MeldMergeControls.tsx`

A toolbar with two buttons:

- **Auto-merge** — calls `props.onAutoMerge` (the dispatcher will run `git merge-file`)
- **Mark as resolved** — calls `props.onMarkResolved` (the dispatcher will write + stage)

```typescript
export interface IMeldMergeControlsProps {
  readonly hasUnresolvedConflicts: boolean
  readonly onAutoMerge: () => void
  readonly onMarkResolved: () => void
}
```

- [ ] **Step 1:** Create the component.
- [ ] **Step 2:** Add a smoke test that verifies both buttons render and click handlers fire.
- [ ] **Step 3:** Commit `feat(meld): add MeldMergeControls component (auto-merge and mark-resolved)`.

---

## Task 9: Wire `mode: 'merge'` into MeldWindow

**Files:**
- Modify: `app/src/ui/meld/MeldWindow.tsx`

Add a new prop to `IMeldWindowProps`:

```typescript
readonly mode: 'working' | 'commit' | 'merge'   // already exists, extend the union to include 'merge'
readonly threeWayState?: IThreeWayState
readonly onAutoMerge?: (repositoryID: number, filePath: string) => Promise<{ mergedContent: string; clean: boolean }>
readonly onMarkMergeResolved?: (repositoryID: number, filePath: string, mergedContent: string) => Promise<{ success: boolean; error?: string }>
readonly onHunkResolved?: (repositoryID: number, filePath: string, hunkIndex: number, side: 'base' | 'local' | 'remote') => void
```

In `render()`, when `mode === 'merge'`, render `MeldThreeWayView` and `MeldMergedPane` side-by-side instead of the 1a/1b `MeldFileTree` + `MeldDiffPane`. Keep the existing toolbar / error banner.

- [ ] **Step 1:** Update the props and state interfaces.
- [ ] **Step 2:** Add a render branch that returns the merge layout.
- [ ] **Step 3:** Wire `onHunkResolved` to call `applyHunkResolution` from `conflictMarkers.ts` and update state.
- [ ] **Step 4:** Add or update tests in `MeldWindow-test.tsx` to cover the merge mode branch.
- [ ] **Step 5:** Commit `feat(meld): wire mode: 'merge' into MeldWindow (3-way + merged panes)`.

---

## Task 10: Wire `meld:open-window` to accept `mode: 'merge'`

**Files:**
- Modify: `app/src/main-process/meld/meld-ipc.ts`
- Modify: `app/src/main-process/meld/meld-window.ts`

The existing `meld:open-window` channel already accepts `IOpenMeldWindowArgs` with a `mode: 'working' | 'commit' | 'merge'`. Extend the runtime check: when `mode === 'merge'`, the renderer route receives the full 3-way state (already in the URL hash from the dispatcher's `openInMeldWindowMergeMode`).

- [ ] **Step 1:** Update the `IOpenMeldWindowArgs` type to include `mergeBaseSha?: string` and `theirsSha?: string`. The renderer uses these to call `readThreeWayContents` on mount.
- [ ] **Step 2:** Add `meld:auto-merge` IPC handler that calls `gitMergeFile` from the main process (since spawning `git` is easier from main).
- [ ] **Step 3:** Update the IPC contract test with the new channel.
- [ ] **Step 4:** Commit `feat(meld): extend meld:open-window and add meld:auto-merge IPC`.

---

## Task 11: Update `MeldWindow` mount point to accept merge mode

**Files:**
- Modify: `app/src/ui/index.tsx`

Extend `parseMeldArgsFromHash` to also read `mergeBaseSha` and `theirsSha` when present, and pass them as props. Add a new prop `threeWayState` to `MeldWindow` (the renderer fetches it via `dispatcher.getThreeWayState` on mount).

- [ ] **Step 1:** Update the hash parser.
- [ ] **Step 2:** Wire the `dispatcher.getThreeWayState` call.
- [ ] **Step 3:** Commit `feat(meld): wire merge mode mount in React entry point`.

---

## Task 12: Add "Open in Meld Window" button to merge-conflict dialog

**Files:**
- Modify: `app/src/ui/merge-conflict/merge-conflict-dialog.tsx`

Per the spec: "the dialog becomes a launcher; clicking a conflicted file in the dialog opens the Meld window in merge mode."

In the per-file action row, add a new button that calls `dispatcher.openInMeldWindowMergeMode(this.props.repository, file.path)`. The existing Accept Ours / Accept Theirs / Mark Resolved buttons stay for backward compat.

- [ ] **Step 1:** Add a private method `onOpenInMeldWindow(path: string)`.
- [ ] **Step 2:** Add the button to the JSX, after the existing "Mark resolved" button.
- [ ] **Step 3:** Commit `feat(meld): add 'Open in Meld Window' button to merge-conflict dialog`.

---

## Task 13: Add SCSS for 4-pane merge layout, conflict highlights, action bar

**Files:**
- Modify: `app/styles/ui/meld/_meld-window.scss`

Add styles for:

- `.meld-three-way-view` — flex row, three equal-width panes
- `.meld-three-way-pane` — individual pane with title bar + read-only pre
- `.meld-three-way-pane[data-active="true"]` — highlighted border
- `.meld-merged-pane` — full-width editable pane
- `.meld-merged-pane-conflict` — background tint for conflict regions
- `.meld-conflict-action-bar` — flex row with three buttons, sticky between conflict regions
- `.meld-conflict-action-bar button` — distinct primary/secondary styling
- `.meld-merge-controls` — toolbar at the top of the merge view

- [ ] **Step 1:** Append the SCSS.
- [ ] **Step 2:** Run `yarn build:dev 2>&1 | tail -3` and confirm success.
- [ ] **Step 3:** Commit `style(meld): add SCSS for 3-way merge view, conflict highlights, action bar`.

---

## Task 14: Update barrel files

**Files:**
- Modify: `app/src/lib/meld/index.ts`
- Modify: `app/src/ui/meld/index.ts`

Export the new modules and components.

- [ ] **Step 1:** Update the barrels.
- [ ] **Step 2:** Commit `feat(meld): export Phase 1c modules from barrels`.

---

## Task 15: Add E2E test for merge flow

**Files:**
- Create: `app/test/e2e/meld/meld-merge-flow-test.ts`

- [ ] **Step 1:** Create the E2E test (skipped at runtime — requires packaged app):
  - Open the existing merge-conflict dialog for a repo with a conflicted file
  - Click "Open in Meld Window" on a file row
  - Verify a new BrowserWindow opens with `.meld-three-way-view` and `.meld-merged-pane`
  - Click "Accept LOCAL" on the first hunk
  - Verify the merged pane no longer shows a conflict marker for that hunk
  - Click "Mark as resolved"
  - Verify the file is staged (no longer shown in the conflict list)
- [ ] **Step 2:** Run `yarn test:e2e --list 2>&1 | head -10` and confirm the test is recognized.
- [ ] **Step 3:** Commit `test(meld): add E2E test for merge flow`.

---

## Task 16: Final smoke test and mark Phase 1c shippable

- [ ] **Run all Meld unit tests:** `yarn test:unit app/test/unit/meld app/test/unit/ui/meld` — expected 110+ tests pass.
- [ ] **Run production build:** `yarn build:prod` — expected success.
- [ ] **Run package:** `yarn package` — expected deb/AppImage/snap produced.
- [ ] **Manual smoke test:** create a real merge conflict in a local repo, open the merge-conflict dialog, click "Open in Meld Window", verify 3-way + merged panes render, accept LOCAL on one hunk, auto-merge, mark as resolved, verify `git status` no longer shows the conflict.
- [ ] **Commit any fixes** as `fix(meld): smoke test fixes for Phase 1c`.
- [ ] **Update this plan** with completion date.

---

## Open Decisions for User Input

Before implementation, two decisions shape the feature:

1. **Conflict-marker style:** Git uses 4 markers (`<<<<<<<`, `||||||| base`, `=======`, `>>>>>>>`) by default but also supports a 3-marker variant when no base is available. Our `conflictMarkers.ts` should handle both. Resolved: handle both, treat absent `|||||||` as `baseContent === ''`.

2. **Auto-merge algorithm:** `git merge-file --ours` resolves hunks by taking the LOCAL side; `--theirs` takes REMOTE; `--union` takes both. For the Auto-merge button, we want the most aggressive: resolve as much as possible and leave only true conflicts. The right invocation is `git merge-file --union <current> <base> <other>` followed by a re-detection of conflict markers. Resolved: use `--union`, then re-parse the output for remaining markers.

3. **Where does auto-merge run?** Renderer (with the working-directory temp files) or main process (cleaner separation, easier to test). Resolved: main process via the new `meld:auto-merge` IPC channel — keeps file IO out of the renderer.

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] **Spec coverage**: Each feature in spec section "Phase 1c — 3-Way Merge View" maps to one or more tasks above:
  - 3-pane layout (BASE / LOCAL / REMOTE) → Task 6
  - 4th MERGED pane with conflict markers → Task 7
  - Click conflict in MERGED → highlight BASE/LOCAL/REMOTE → Task 6, 7, 9
  - Accept LOCAL / Accept REMOTE / Use BASE per hunk → Task 2, 7
  - Auto-merge via `git merge-file --union` → Task 3, 5
  - Mark as resolved (write + stage) → Task 5
  - merge-conflict-dialog "Open in Meld Window" button → Task 12
- [ ] **Placeholder scan**: No "TBD" / "TODO" in plan ✓
- [ ] **Type consistency**: `IThreeWayState`, `IConflictHunk`, `IConflictHunk`-derived types used consistently across tasks ✓
- [ ] **No gaps**: Every spec success criterion has a task ✓

---

## Success Criteria

Phase 1c is done when:
- When a file has conflicts, "Merge" mode is selectable in the Meld window.
- 3-way layout shows BASE, LOCAL, REMOTE, MERGED panes.
- User can accept LOCAL or REMOTE per hunk; MERGED updates accordingly.
- Auto-merge button resolves non-conflicting regions automatically.
- "Mark as resolved" writes the merged result to disk with conflict markers removed, stages the file.
- Opening a conflicted file from the existing `merge-conflict-dialog` opens the Meld window in merge mode.
- `yarn build:prod` succeeds and `yarn package` produces artifacts.
- All Meld unit tests pass.

After 1c ships, move to Phase 2 (SmartGit Diff Integrations: blame gutter, stash mode, reflog wiring, submodule diffs).

---

## Phase 1c completion — 2026-06-06

All 16 tasks shipped on the `linux` branch.

**Test results:**
- 131/131 Meld unit tests pass (22 suites across `app/test/unit/meld` and `app/test/unit/ui/meld`).
- `yarn build:prod` succeeds.
- `yarn package` produces AppImage, snap, and deb artifacts in `dist/`.

**T9 fix:** Renamed props `mode` → `windowMode` in MeldWindow render to disambiguate from local state `mode` (IMeldMode vs IMeldWindowMode). Caught by tsl — would have shipped a confusing type bug.

**T11/T12 wiring:** Extracted dispatcher `_resolveMergeShas` helper to share SHA resolution between `getThreeWayState` and `openInMeldWindowMergeMode`. The window's mergeBaseSha/theirsSha now flow through the URL hash so the renderer can fetch the three-way state on mount without an extra round-trip.

**T15 note:** E2E test follows the existing `meld-basic-flow-test.ts` pattern but is named `meld-merge-flow.e2e.ts` (matching the `testMatch: '*.e2e.ts'` config) so Playwright actually picks it up. The test is `test.skip(...)` — requires a packaged app with a real in-progress merge.

**Commits added in this phase (T9-T15):**
- `ccaeceb201` feat(meld): wire mode: 'merge' into MeldWindow
- `f8505eff41` feat(meld): extend meld:open-window and add meld:auto-merge IPC
- `ed62a5acde` feat(meld): wire merge mode mount in React entry point
- `b10e0281d7` feat(meld): add 'Open in Meld Window' button to merge-conflict dialog
- `ebb13e16e0` style(meld): add SCSS for 3-way merge view
- `48c4a2d159` feat(meld): export Phase 1c modules from barrels
- `a614606e97` test(meld): add E2E test for merge flow
