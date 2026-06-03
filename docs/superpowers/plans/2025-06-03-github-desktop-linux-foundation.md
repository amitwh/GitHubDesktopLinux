# GitHub Desktop Linux Port — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync upstream changes, create the `feat/linux-port` branch, verify the app builds and runs on Ubuntu, add a Linux CI workflow, and integrate JetBrains Mono as the default monospace font.

**Architecture:** This is a foundation sub-project. It establishes the Linux development branch and ensures the existing Electron app compiles and launches on Ubuntu. No new application features are added beyond the font change and CI.

**Tech Stack:** Electron, React 16, TypeScript, Webpack 5, SCSS, Yarn 1.x, GitHub Actions, `@fontsource/jetbrains-mono`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `.github/workflows/ci-linux.yml` | Create | Linux CI workflow (build, lint, unit tests, smoke test) |
| `app/package.json` | Modify | Add `@fontsource/jetbrains-mono` dependency |
| `app/src/ui/index.tsx` | Modify | Import JetBrains Mono font CSS |
| `app/styles/_variables.scss` | Modify | Update `--font-family-monospace` CSS variable |
| `app/src/ui/get-monospace-font-family.ts` | Modify | Update hardcoded monospace font string |
| `docs/contributing/setup-linux.md` | Modify | Add missing `libgconf-2-4` note (already documented, verify) |

---

### Task 1: Upstream Sync & Branch Creation

**Files:** None (git commands only)

- [ ] **Step 1: Fetch upstream**

```bash
git fetch upstream
```

Expected: Fetches all refs from `desktop/desktop`.

- [ ] **Step 2: Merge upstream into local development**

```bash
git checkout development
git merge upstream/development
```

Expected: Fast-forwards or prompts for conflict resolution. If conflicts appear, resolve them manually, then `git add . && git merge --continue`.

- [ ] **Step 3: Push updated development to origin**

```bash
git push origin development
```

Expected: `development` branch on origin now matches upstream.

- [ ] **Step 4: Create and push the Linux feature branch**

```bash
git checkout -b feat/linux-port
git push -u origin feat/linux-port
```

Expected: New branch `feat/linux-port` exists locally and on origin.

- [ ] **Step 5: Commit**

```bash
git log --oneline -3
```

Expected: Top commit is from upstream. No uncommitted changes.

---

### Task 2: Build Verification on Linux

**Files:** None (commands only, may reveal needed fixes)

- [ ] **Step 1: Verify system dependencies**

```bash
sudo apt install -y libsecret-1-dev libgconf-2-4
node -v
yarn -v
python --version
```

Expected: Node version matches `.nvmrc` (or is v20+), Yarn 1.x, Python 3.9+.

- [ ] **Step 2: Install Node dependencies**

```bash
yarn install --frozen-lockfile
```

Expected: Completes without errors. If `desktop-trampoline` or `desktop-notifications` native builds fail, install `build-essential`:

```bash
sudo apt install -y build-essential
```

- [ ] **Step 3: Run production build**

```bash
yarn build:prod
```

Expected: Exits with code 0. Webpack compiles successfully. If it fails due to memory, run:

```bash
NODE_OPTIONS='--max_old_space_size=4096' yarn build:prod
```

- [ ] **Step 4: Launch the app**

```bash
yarn start
```

Expected: Electron window opens. Look for crashes in the terminal. If the app crashes immediately with a `keytar` or native module error, verify `libsecret-1-dev` is installed and rebuild native modules:

```bash
yarn install --force
```

- [ ] **Step 5: Run unit tests**

```bash
yarn test:unit
```

Expected: Tests pass. It's okay if a few are platform-specific and skip on Linux.

- [ ] **Step 6: Run linter**

```bash
yarn eslint
```

Expected: Exits with code 0.

- [ ] **Step 7: Commit any required fixes**

If no fixes were needed:

```bash
git status
```

Expected: Working tree clean.

If fixes were needed (e.g., `package.json` scripts adjusted, missing deps documented):

```bash
git add -A
git commit -m "fix: resolve Linux build issues for foundation branch"
```

---

### Task 3: Linux CI Workflow

**Files:**
- Create: `.github/workflows/ci-linux.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/ci-linux.yml` with this content:

```yaml
name: CI — Linux

on:
  push:
    branches:
      - feat/linux-port
  pull_request:
    branches:
      - feat/linux-port

env:
  NODE_VERSION: 24.15.0

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: yarn
      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libsecret-1-dev libgconf-2-4
      - run: yarn
      - run: yarn validate-electron-version
      - run: yarn eslint
      - run: yarn validate-changelog
      - name: Ensure a clean working directory
        run: git diff --name-status --exit-code

  build:
    name: Build — Ubuntu
    runs-on: ${{ matrix.os }}
    permissions:
      contents: read
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-22.04, ubuntu-24.04]
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: yarn
      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libsecret-1-dev libgconf-2-4
      - run: yarn
      - name: Build production app
        run: yarn build:prod
        env:
          NODE_OPTIONS: '--max_old_space_size=4096'
      - name: Prepare testing environment
        run: yarn test:setup
      - name: Run unit tests
        run: yarn test:unit
      - name: Run script tests
        run: yarn test:script
      - name: Package production app (Linux)
        run: yarn package
```

- [ ] **Step 2: Validate workflow syntax**

```bash
cat .github/workflows/ci-linux.yml | head -20
```

Expected: File exists and YAML indentation is correct.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci-linux.yml
git commit -m "ci: add Linux CI workflow for feat/linux-port branch"
```

---

### Task 4: JetBrains Mono Font Integration

**Files:**
- Modify: `app/package.json`
- Modify: `app/src/ui/index.tsx`
- Modify: `app/styles/_variables.scss`
- Modify: `app/src/ui/get-monospace-font-family.ts`

- [ ] **Step 1: Install the font package**

```bash
cd app
yarn add @fontsource/jetbrains-mono
cd ..
```

Expected: `app/package.json` now lists `@fontsource/jetbrains-mono` in `dependencies`.

- [ ] **Step 2: Import font CSS in the renderer entry**

Open `app/src/ui/index.tsx`. Add these two imports **before** the existing `import '../lib/logging/renderer/install'` line (or immediately after it):

```typescript
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
```

The top of `app/src/ui/index.tsx` should look like:

```typescript
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'

import '../lib/logging/renderer/install'
// ... rest of imports
```

- [ ] **Step 3: Update SCSS monospace variable**

Open `app/styles/_variables.scss`. Find line 71:

```scss
--font-family-monospace: SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace, #{$emoji_fallback_fonts};
```

Replace it with:

```scss
--font-family-monospace: 'JetBrains Mono', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo', monospace, #{$emoji_fallback_fonts};
```

- [ ] **Step 4: Update TypeScript monospace helper**

Open `app/src/ui/get-monospace-font-family.ts`. Replace the entire file content with:

```typescript
export const getMonospaceFontFamily = (): string => {
  return "'JetBrains Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace, 'Apple Color Emoji', 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Symbol'"
}
```

- [ ] **Step 5: Verify the build still passes**

```bash
yarn build:prod
```

Expected: Exits with code 0. Webpack bundles the font CSS files successfully.

- [ ] **Step 6: Launch the app and verify font rendering**

```bash
yarn start
```

Expected: App opens. Open any repository with a diff. The diff text should render in JetBrains Mono. Open DevTools (`Ctrl+Shift+I`), select a `<code>` element, and verify in the Computed styles tab that `font-family` starts with `'JetBrains Mono'`.

- [ ] **Step 7: Run unit tests and linter**

```bash
yarn test:unit
yarn eslint
```

Expected: Both pass.

- [ ] **Step 8: Commit**

```bash
git add app/package.json app/src/ui/index.tsx app/styles/_variables.scss app/src/ui/get-monospace-font-family.ts
git commit -m "feat: set JetBrains Mono as default monospace font"
```

---

### Task 5: Final Verification & Documentation Update

**Files:**
- Modify: `docs/contributing/setup-linux.md` (if gaps found)

- [ ] **Step 1: Run full local verification**

```bash
yarn install --frozen-lockfile
yarn build:prod
yarn test:unit
yarn eslint
yarn start
```

Expected: All commands succeed. App launches.

- [ ] **Step 2: Update Linux setup docs if needed**

Open `docs/contributing/setup-linux.md`. If any missing dependency was discovered during build verification (e.g., `build-essential`, `libxss1`), add it. For example, add after line 62:

```markdown
### Additional dependencies for native modules

Some distributions may also need:

```bash
$ sudo apt install -y build-essential libxss1
```
```

If no changes are needed, skip this step.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: update Linux setup guide with build prerequisites" || echo "No changes to commit"
```

- [ ] **Step 4: Push the feature branch**

```bash
git push origin feat/linux-port
```

Expected: Branch pushed. CI should trigger automatically if the workflow file is present.

---

## Self-Review

### Spec Coverage

| Spec Section | Plan Task |
|--------------|-----------|
| Git workflow (upstream sync, branch creation) | Task 1 |
| Linux build verification | Task 2 |
| Linux CI workflow | Task 3 |
| JetBrains Mono font integration | Task 4 |
| Error handling (build failures, missing deps) | Task 2, Task 5 |
| Testing checklist | Task 2, Task 4, Task 5 |

All spec sections are covered.

### Placeholder Scan

- No `TBD`, `TODO`, or "implement later" strings.
- No vague "add appropriate error handling" steps. Every error scenario has a concrete command or fix.
- No "write tests for the above" without test code. Tests are the upstream `yarn test:unit` and `yarn eslint` commands.
- No "similar to Task N" references.
- All file paths are exact.

### Type Consistency

- `--font-family-monospace` updated in SCSS and TypeScript helper with the same font stack.
- `@fontsource/jetbrains-mono/400.css` and `/700.css` imported in renderer entry.

No inconsistencies found.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2025-06-03-github-desktop-linux-foundation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
