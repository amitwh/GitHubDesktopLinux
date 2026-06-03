# SmartGit-like Features — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add six SmartGit-like features to GitHub Desktop Linux fork, then build and release all Linux package formats.

**Execution Order:** Easiest → Hardest → Releases
1. RefLog Viewer (medium, mostly read-only UI)
2. Blame/Annotate Inline (medium, extends diff view)
3. Advanced Stash Management (medium, extends existing stash UI)
4. Merge Conflict Tool (hard, new UI + git operations)
5. Interactive Rebase UI (hard, complex state machine)
6. Submodule Support (hard, multi-repo coordination)
7. Build Releases (.deb, AppImage, Snap, Flatpak with version bump)

---

## Feature 1: RefLog Viewer

**What:** View the reflog (history of HEAD movements) for the current repository.

**Files:**
- Create: `app/src/lib/git/reflog.ts` — `getReflog(repository, branch?)` using `git reflog`
- Create: `app/src/models/reflog-entry.ts` — `ReflogEntry` model
- Create: `app/src/ui/reflog/` — Dialog component
- Modify: `app/src/main-process/menu/build-default-menu.ts` — Add "View Reflog…"
- Modify: `app/src/models/popup.ts` — Add `ViewReflog` popup type
- Modify: `app/src/ui/dispatcher/dispatcher.ts` — Add `showReflogDialog`
- Modify: `app/src/ui/app.tsx` — Render dialog, handle menu event

---

## Feature 2: Blame/Annotate Inline

**What:** Show line-by-line author attribution inline in the diff viewer.

**Files:**
- Create: `app/src/lib/git/blame.ts` — `getBlameInfo(repository, path)` using `git blame --porcelain`
- Create: `app/src/models/blame-hunk.ts` — `BlameHunk` model
- Modify: `app/src/ui/diff/` — Add blame gutter to diff components
- Modify: `app/src/main-process/menu/build-default-menu.ts` — Add "Show Blame" toggle
- Modify: `app/src/lib/app-state.ts` — Add `blameVisible` state

---

## Feature 3: Advanced Stash Management

**What:** View all stashes in a list, apply/drop individual stashes, view stash diffs.

**Files:**
- Create: `app/src/ui/stash/` — Stash list dialog with apply/drop buttons
- Modify: `app/src/lib/git/stash.ts` — Add `getStashList`, `dropStashEntry`
- Modify: `app/src/main-process/menu/build-default-menu.ts` — Add "View Stashes…"
- Modify: `app/src/models/popup.ts` — Add `ViewStashes` popup type
- Modify: `app/src/ui/dispatcher/dispatcher.ts` — Add stash dialog action
- Modify: `app/src/ui/app.tsx` — Render stash dialog

---

## Feature 4: Merge Conflict Tool

**What:** Built-in three-way merge conflict resolver with Accept Ours/Theirs/Mark Resolved actions.

**Files:**
- Create: `app/src/lib/git/merge.ts` — `getConflictedFiles`, `resolveConflict`
- Create: `app/src/ui/merge-conflict/` — Conflict resolution dialog
- Modify: `app/src/ui/changes/` — Show conflicted files with resolution buttons
- Modify: `app/src/main-process/menu/build-default-menu.ts` — Add conflict resolution menu

---

## Feature 5: Interactive Rebase UI

**What:** Visual editor for `git rebase -i` — reorder, squash, fixup, drop commits.

**Files:**
- Create: `app/src/lib/git/rebase.ts` — `startInteractiveRebase`, `continueRebase`
- Create: `app/src/ui/interactive-rebase/` — Rebase todo list editor
- Modify: `app/src/main-process/menu/build-default-menu.ts` — Add "Interactive Rebase…"
- Modify: `app/src/models/popup.ts` — Add `InteractiveRebase` popup type
- Modify: `app/src/ui/dispatcher/dispatcher.ts` — Add rebase actions
- Modify: `app/src/ui/app.tsx` — Render rebase dialog

---

## Feature 6: Submodule Support

**What:** Initialize, update, sync, and view submodule status.

**Files:**
- Create: `app/src/lib/git/submodule.ts` — `getSubmodules`, `updateSubmodule`, `syncSubmodule`
- Create: `app/src/models/submodule.ts` — `Submodule` model
- Create: `app/src/ui/submodule/` — Submodule management dialog
- Modify: `app/src/main-process/menu/build-default-menu.ts` — Add "Submodules…"
- Modify: `app/src/models/popup.ts` — Add `SubmoduleManagement` popup type
- Modify: `app/src/ui/dispatcher/dispatcher.ts` — Add submodule actions
- Modify: `app/src/ui/app.tsx` — Render submodule dialog

---

## Feature 7: Build Releases

**What:** Bump version, build all Linux packages, tag release.

**Files:**
- Modify: `app/package.json` — Bump version
- Modify: `electron-builder.yml` — Ensure artifact names are correct
- Commands: `yarn build:prod`, `yarn package:linux`
- Tag: `git tag -a v3.5.12-linux1 -m "Linux release v3.5.12-linux1"`
- Push: `git push origin linux --tags`
- CI: Trigger workflow manually or verify artifacts

---

## Self-Review

All six features follow the same wiring pattern established in Sub-Project 3:
1. Git operation in `app/src/lib/git/`
2. Model in `app/src/models/`
3. UI dialog in `app/src/ui/<feature>/`
4. Popup type in `app/src/models/popup.ts`
5. Dispatcher action in `app/src/ui/dispatcher/dispatcher.ts`
6. Menu item in `app/src/main-process/menu/build-default-menu.ts`
7. Menu event in `app/src/main-process/menu/menu-event.ts`
8. App.tsx render case and menu handler

This pattern is well-established and reproducible.
