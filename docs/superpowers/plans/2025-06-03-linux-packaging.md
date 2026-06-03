# Linux Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build distributable Linux packages for GitHub Desktop in `.deb`, AppImage, Snap, and Flatpak formats.

**Architecture:** Use `electron-builder` with `--prepackaged` to create installers from the existing `electron-packager` output (`dist/desktop-linux-x64/`). Add a `package:linux` script and update CI to upload artifacts.

**Tech Stack:** Electron, electron-builder, electron-packager, GitHub Actions

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add electron-builder devDependency and `package:linux` script |
| `electron-builder.yml` | Create | Linux packaging config (deb, AppImage, snap, flatpak targets) |
| `script/package.ts` | Modify | Add Linux packaging function instead of failing |
| `.github/workflows/ci-linux.yml` | Modify | Add artifact upload step for built packages |

---

### Task 1: Install electron-builder

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install electron-builder**

```bash
cd /home/amith/apps/GitHubDesktop
yarn add -D electron-builder
```

- [ ] **Step 2: Add package:linux script**

Add to root `package.json` scripts:
```json
"package:linux": "electron-builder --linux --prepackaged dist/desktop-linux-x64 --publish never"
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add electron-builder for Linux packaging"
```

---

### Task 2: Create electron-builder config

**Files:**
- Create: `electron-builder.yml`

- [ ] **Step 1: Create config file**

Create `electron-builder.yml`:

```yaml
appId: com.github.GitHubClient
productName: GitHub Desktop
linux:
  category: Development
  maintainer: GitHub Desktop Linux Fork
  vendor: GitHub, Inc.
  synopsis: Simple collaboration from your desktop
  description: |
    GitHub Desktop is an open source Electron-based GitHub app.
    It is written in TypeScript and uses React.
  target:
    - target: deb
      arch: x64
    - target: AppImage
      arch: x64
    - target: snap
      arch: x64
    - target: flatpak
      arch: x64
  icon: app/static/logos/prod/icon-logo.png
directories:
  buildResources: build
deb:
  priority: optional
  depends:
    - libsecret-1-0
    - libgconf-2-4
    - git
appImage:
  artifactName: GitHub-Desktop-${version}.AppImage
snap:
  summary: Simple collaboration from your desktop
  grade: stable
  confinement: classic
  plugs:
    - default
    - removable-media
    - password-manager-service
flatpak:
  runtime: org.freedesktop.Platform
  runtimeVersion: "23.08"
  sdk: org.freedesktop.Sdk
  base: org.electronjs.Electron2.BaseApp
  baseVersion: "23.08"
  finishArgs:
    - --share=ipc
    - --socket=x11
    - --socket=wayland
    - --socket=pulseaudio
    - --share=network
    - --device=dri
    - --filesystem=host
    - --talk-name=org.freedesktop.secrets
    - --talk-name=org.gnome.keyring.SystemPrompter
```

- [ ] **Step 2: Commit**

```bash
git add electron-builder.yml
git commit -m "build: add electron-builder config for Linux packages"
```

---

### Task 3: Add Linux packaging to script/package.ts

**Files:**
- Modify: `script/package.ts`

- [ ] **Step 1: Add Linux packaging function**

In `script/package.ts`, replace the `else` block at lines 42-45:

```typescript
} else if (process.platform === 'linux') {
  packageLinux()
} else {
```

And add the `packageLinux()` function after `packageWindows()`:

```typescript
function packageLinux() {
  console.log('Packaging for Linux with electron-builder…')
  cp.execSync('yarn package:linux', { stdio: 'inherit' })
  console.log(`Linux packages created in ${outputDir}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add script/package.ts
git commit -m "build: add Linux packaging support to package script"
```

---

### Task 4: Build all Linux packages

**Files:** None (commands only)

- [ ] **Step 1: Ensure build artifacts exist**

```bash
cd /home/amith/apps/GitHubDesktop
yarn build:prod
```

- [ ] **Step 2: Build packages**

```bash
yarn package:linux
```

Expected: Creates `.deb`, `.AppImage`, `.snap`, and Flatpak files in `dist/`.

- [ ] **Step 3: Verify artifacts**

```bash
ls -la dist/*.deb dist/*.AppImage dist/*.snap dist/*.flatpak 2>/dev/null || ls -la dist/
```

- [ ] **Step 4: Commit any needed fixes**

If build fails, fix config and retry. If successful, no commit needed.

---

### Task 5: Update CI to upload artifacts

**Files:**
- Modify: `.github/workflows/ci-linux.yml`

- [ ] **Step 1: Add artifact upload step**

Add to the build job after the package step:

```yaml
      - name: Upload Linux packages
        uses: actions/upload-artifact@v4
        with:
          name: linux-packages-${{ matrix.os }}
          path: |
            dist/*.deb
            dist/*.AppImage
            dist/*.snap
          if-no-files-found: warn
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci-linux.yml
git commit -m "ci: upload Linux package artifacts in CI"
```

---

### Task 6: Final verification and push

**Files:** None

- [ ] **Step 1: Run linter**

```bash
yarn eslint
```

- [ ] **Step 2: Push linux branch**

```bash
git push origin linux
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|-------------|------|
| Install electron-builder | Task 1 |
| Create config for all 4 formats | Task 2 |
| Add Linux to package script | Task 3 |
| Build packages | Task 4 |
| Upload artifacts in CI | Task 5 |

All covered.

### Placeholder Scan

- No TBD/TODO.
- All file paths exact.
- All commands exact.
