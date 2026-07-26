# Worktree Phase 0+1 — Linux Verification + Housekeeping & Safety

**Date:** 2026-07-26
**Status:** Approved (brainstorming session, user delegated autonomous completion)
**Branch:** `linux` (fork of `desktop/desktop`, upstream synced to 3.6.4-beta1)

---

## Background

Upstream `desktop/desktop` already ships worktree support, merged into this fork on
2026-07-26 (355 commits, up to 3.6.4-beta1):

- Git wrappers: `app/src/lib/git/worktree.ts` — `listWorktrees`, `addWorktree`,
  `removeWorktree`, `moveWorktree`. The porcelain parser already extracts `locked`
  and `prunable` flags (worktree.ts:41-43), currently unused by UI.
- UI: `app/src/ui/worktrees/` — add/delete/rename dialogs, worktree list,
  list-item context menu.
- Menus: "New Worktree…" and "Show Worktrees List", gated on
  `enableWorktreeSupport()` which returns `true` (`app/src/lib/feature-flag.ts:127`).
- State: `AppStore._refreshWorktrees` (app-store.ts:4368) caches `worktrees` in
  repository state.
- Branch pruner protects branches checked out in linked worktrees
  (`app/src/lib/stores/helpers/branch-pruner.ts:202`).

## Roadmap Context

This spec covers the first two of five phases. Later phases (separate specs):
Phase 2 — PR → worktree flow; Phase 3 — Meld × worktrees; Phase 4 — bare +
worktrees project layout.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Scope | Verify upstream worktree behavior on Linux, then extend |
| Deleting a dirty worktree | Warn with modified/untracked counts + mandatory force-confirm checkbox |
| Stale worktree cleanup | Warning badge in list + manual "Prune…" flow + opt-in auto-prune preference (default off) |
| Disk-usage display | Always shown; computed asynchronously so the list never blocks |
| Architecture | Extend upstream's existing files/patterns (Option A) — minimal upstream-merge friction |

## Phase 0 — Linux Verification

**Automated:** run upstream's existing worktree unit tests against the fork.

**Manual checklist** (packaged .deb/AppImage, real repositories):
1. Create worktree from branch selector and from menu
2. Switch between main and linked worktrees
3. Rename worktree
4. Delete clean worktree
5. Missing-folder fallback: delete a worktree directory externally, confirm the
   repository falls back to the main worktree instead of appearing missing
6. Screen-reader group labels ("Main Worktree" / "Linked Worktrees")
7. "New Worktree…" / "Show Worktrees List" menu items render and work on Linux

**Output:** findings doc; Linux bugs found are fixed within this phase before
Phase 1 begins.

## Phase 1 — Housekeeping & Safety

### Git layer (`app/src/lib/git/worktree.ts`)

Four new wrappers, following existing dugite patterns in the file:

- `lockWorktree(repository, path, reason?)` → `git worktree lock [--reason <r>] <path>`
- `unlockWorktree(repository, path)` → `git worktree unlock <path>`
- `pruneWorktrees(repository, dryRun)` → `git worktree prune -n -v` (dry-run;
  parse verbose output to return the paths that *would* be pruned) or
  `git worktree prune -v` (execute)
- `getWorktreeDirtyState(path)` → `git status --porcelain` inside the worktree;
  returns `{ modifiedCount, untrackedCount }`

### State & data flow

- New dispatcher → app-store actions: `_lockWorktree`, `_unlockWorktree`,
  `_pruneWorktrees`, `_getWorktreeDirtyState`; all end with `_refreshWorktrees`
  so cached state and UI stay consistent.
- Disk sizes: new `worktree:compute-sizes` IPC channel (registration pattern of
  `app/src/main-process/meld/meld-ipc.ts`), main-process non-blocking directory
  walk. Sizes cached in repository state keyed by worktree path; list renders
  with a placeholder and sizes fill in asynchronously.
- Auto-prune: when the preference is enabled, `_refreshWorktrees` runs prune and
  re-lists. Failures are logged and never block repository open.

### UI

- `worktree-list-item.tsx`: "Locked" badge (lock icon) when locked; "Stale —
  folder missing" badge when the worktree directory no longer exists — checked
  via `fs.existsSync` at list-render time (the `prunable` porcelain flag only
  appears after git's prune expiry, so existence is the responsive signal;
  `prunable` remains the fallback for the prune dry-run path); formatted size
  text.
- `worktree-list-item-context-menu.ts`: Lock… / Unlock items per worktree.
- Worktree list: "Prune stale worktrees…" action opening a confirmation dialog
  listing stale paths (from dry-run), confirming executes prune.
- `delete-worktree-dialog.tsx`: when dirty, show "This worktree has N modified
  and M untracked files"; Delete stays disabled until a force-confirm checkbox
  is ticked.
- `app/src/ui/preferences/advanced.tsx`: "Automatically prune stale worktrees
  when opening a repository" checkbox (default off), persisted via existing
  preferences storage.

### Error handling

- lock/unlock/prune failures → existing dispatcher error-dialog flow.
- Size computation failure → render "—", log; never crash the list.
- Dry-run parse failure → fall back to the already-parsed `prunable` flags.
- Auto-prune failure → log only; repository open is never blocked.

### Testing

- Unit: the four git wrappers (mocked dugite), dirty-state counter, prune
  verbose-output parser (including dry-run).
- Component: list-item badges + size, delete-dialog force checkbox, preferences
  toggle.
- IPC contract test for `worktree:compute-sizes` (pattern of
  `app/test/unit/ipc-contract-test.ts`).
- Phase 0: upstream worktree suites pass; manual checklist completed.

## Out of scope (Phase 0+1)

PR-to-worktree checkout flows, Meld integration across worktrees, bare-repo
project layouts, worktree create-from-commit UX, remote pruning.
