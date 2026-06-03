# GitHub Desktop Linux Port — Foundation Design

**Date:** 2025-06-03  
**Sub-Project:** 1 of N  
**Branch:** `feat/linux-port` (to be created)  
**Status:** Design Approved

---

## Overview

This document specifies the foundation work required to establish a Linux-specific development branch for the GitHub Desktop fork. The goal is to sync the latest upstream changes, create a stable Linux development branch, verify the app builds and runs on Ubuntu, set up Linux CI, and integrate JetBrains Mono as the default monospace font.

All packaging work and feature enhancements (including SmartGit-like features and commit history export) are explicitly deferred to subsequent sub-projects.

---

## Context

- **Upstream:** `desktop/desktop` (official GitHub Desktop repository)
- **Fork:** `amitwh/GitHubDesktop`
- **Current fork version:** 3.5.11
- **Upstream version:** 3.5.12-beta2 (ahead of fork)
- **Existing Linux code:** `app/src/lib/editors/linux.ts`, `app/src/lib/shells/linux.ts`
- **Missing:** Linux packaging scripts, Linux CI workflows, Linux-specific build automation

---

## Section 1: Git Workflow — Upstream Sync & Branch Creation

### Steps

1. `git fetch upstream` — pull latest refs from `desktop/desktop`
2. `git checkout development`
3. `git merge upstream/development` — fast-forward or resolve conflicts manually
4. `git push origin development` — update the fork's `development` branch
5. `git checkout -b feat/linux-port` — create the Linux-specific development branch
6. `git push -u origin feat/linux-port`

### Conflict Resolution

- If merge conflicts arise, resolve them manually.
- Document any non-trivial resolutions in the commit message.
- Prefer upstream's changes unless they break known Linux functionality.

### Success Criteria

- `feat/linux-port` branch exists on origin.
- Branch contains all commits from `upstream/development`.
- No uncommitted merge conflicts.

---

## Section 2: Linux Build Verification

### Prerequisites

Per `docs/contributing/setup-linux.md`, ensure the following system packages are installed on Ubuntu:

```bash
sudo apt install -y libsecret-1-dev libgconf-2-4
```

Also required: Node.js (v20.17.0 per upstream), Yarn 1.x, Python 3.9+.

### Verification Steps

1. `yarn install` — verify all dependencies install cleanly on Linux.
2. `yarn build:prod` — verify production webpack build succeeds.
3. Launch the app and confirm the main window opens without crashes.
4. Audit existing Linux platform code:
   - `app/src/lib/editors/linux.ts` — verify editor detection works
   - `app/src/lib/shells/linux.ts` — verify shell integration works
5. Search for hardcoded `process.platform === 'darwin'` or `process.platform === 'win32'` guards that may need Linux equivalents.

### Known Gaps to Address

- No Linux packaging scripts exist yet (deferred to Sub-Project 2).
- Some features may be platform-gated and require Linux equivalents.
- `desktop-notifications` and `desktop-trampoline` vendor deps may need Linux build verification.

### Success Criteria

- `yarn build:prod` exits with code 0.
- App launches and displays the main window on Ubuntu.
- No critical errors in the terminal or DevTools console at launch.

---

## Section 3: CI/CD — GitHub Actions for Linux

### Workflow File

`.github/workflows/ci-linux.yml`

### Strategy

- **OS matrix:** `ubuntu-22.04`, `ubuntu-24.04`
- **Node version:** read from `.nvmrc` (or pinned to match upstream)

### Jobs

#### Job 1: Build

```yaml
- name: Install dependencies
  run: yarn install --frozen-lockfile
- name: Build production
  run: yarn build:prod
```

#### Job 2: Lint & Unit Tests

```yaml
- name: Run ESLint
  run: yarn eslint
- name: Run unit tests
  run: yarn test:unit
```

#### Job 3: E2E Smoke Test

- Build packaged app: `yarn test:e2e:build:packaged`
- Run a minimal Playwright test that verifies the app window opens on Linux.
- If Playwright E2E tests are not stable on Linux runners initially, replace with a simple Electron launch-and-screenshot smoke test.

### Success Criteria

- CI workflow file is merged into `feat/linux-port`.
- All three jobs pass on both Ubuntu versions.
- CI runs on every push and PR targeting `feat/linux-port`.

---

## Section 4: JetBrains Mono Font Integration

### Goal

Set JetBrains Mono as the default monospace font for all code and diff views in the app, replacing the current default system monospace font.

### Implementation

1. **Add the font.** Use the npm package `@fontsource/jetbrains-mono` (or equivalent) to avoid manually managing font files. Install as a dependency in `app/package.json`.
2. **Import the font.** In the app's main entry or global CSS file, import the font:
   ```typescript
   import '@fontsource/jetbrains-mono/400.css'
   import '@fontsource/jetbrains-mono/700.css'
   ```
3. **Apply the font.** Update the app's styled-components / CSS to use `JetBrains Mono` for:
   - Diff viewer (`app/src/ui/diff/`)
   - Commit message input (`app/src/ui/changes/`)
   - Any `monospace` or `code` styled elements
   - Ensure the font stack is: `'JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace`
4. **Theme compatibility.** Verify font renders correctly in both light and dark themes.
5. **Fallback.** If the npm package fails to load, the CSS fallback stack ensures system monospace is used.

### Files Likely to Change

- `app/package.json` — add `@fontsource/jetbrains-mono`
- `app/styles/ui/_globals.scss` or equivalent global CSS — add font-face import
- `app/src/ui/app-theme.tsx` or theme provider — add font family variable
- Any component explicitly setting `font-family: monospace` — update to use theme variable

### Success Criteria

- JetBrains Mono renders in the diff viewer.
- JetBrains Mono renders in the commit message text area.
- Font is consistent across light and dark themes.
- App still builds and launches after font changes.

---

## Section 5: Error Handling & Testing

### Error Scenarios

| Scenario | Handling |
|----------|----------|
| Merge conflicts from upstream | Resolve manually; document in commit message |
| `yarn install` fails on Linux | Check for missing native deps (`libsecret`, `libgconf`) |
| `yarn build:prod` fails | Check webpack logs; verify Node/Yarn versions match upstream |
| App crashes on launch | Check `keytar`/`desktop-trampoline` native module loading |
| Font does not load | Verify webpack CSS loader includes font files; check fallback |
| CI runner fails | Check GitHub Actions logs; may need `xvfb` for headless Electron |

### Testing Checklist

- [ ] `git fetch upstream && git merge upstream/development` succeeds
- [ ] `feat/linux-port` branch pushed to origin
- [ ] `yarn install` completes without errors
- [ ] `yarn build:prod` exits 0
- [ ] App launches on Ubuntu and main window is visible
- [ ] `yarn eslint` passes
- [ ] `yarn test:unit` passes
- [ ] Linux CI workflow passes on `ubuntu-22.04`
- [ ] Linux CI workflow passes on `ubuntu-24.04`
- [ ] JetBrains Mono is used in diff viewer
- [ ] JetBrains Mono is used in commit message input

---

## Deferred Scope (Sub-Projects 2+)

The following are explicitly **not** in scope for this sub-project:

| Feature | Deferred To |
|---------|-------------|
| `.deb` packaging | Sub-Project 2 |
| AppImage packaging | Sub-Project 2 |
| Snap packaging | Sub-Project 2 |
| Flatpak packaging | Sub-Project 2 |
| Commit history export (.md / .pdf) | Sub-Project 3 |
| Advanced stash management | Sub-Project 4+ |
| Interactive rebase UI | Sub-Project 4+ |
| Submodule management | Sub-Project 4+ |
| RefLog viewer | Sub-Project 4+ |
| Blame/annotate inline | Sub-Project 4+ |
| Merge conflict tool | Sub-Project 4+ |
| SSH key management UI | Sub-Project 4+ |

---

## Dependencies

- `@fontsource/jetbrains-mono` (new dev/runtime dependency)
- Existing upstream dependencies (no changes expected)

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Upstream merge conflicts | Medium | Resolve carefully; prefer upstream changes |
| Native module build failure on Linux | Medium | Ensure `libsecret-dev` and build tools are installed |
| E2E tests flaky on Linux CI | High | Start with smoke test; expand coverage incrementally |
| Font loading issues in Electron | Low | Use `@fontsource` npm package; verify webpack config |

---

## Approval

Design approved by project owner on 2025-06-03.
