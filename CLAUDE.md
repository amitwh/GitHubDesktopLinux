# GitHub Desktop — Linux Fork (CLAUDE.md)

Project-specific instructions for the GitHub Desktop Linux fork maintained by `amitwh`.

---

## Project Overview

This is a fork of the official [`desktop/desktop`](https://github.com/desktop/desktop) repository, focused on building a fully-featured Linux version of GitHub Desktop with enhanced functionality inspired by SmartGit.

- **Fork:** `amitwh/GitHubDesktop`
- **Upstream:** `desktop/desktop`
- **Primary branch:** `development` (synced from upstream)
- **Linux development branch:** `feat/linux-port`
- **License:** MIT

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron |
| UI | React 16.8+, TypeScript |
| State | Internal stores (no Redux) |
| Build | Webpack 5, ts-node |
| Package Manager | Yarn 1.x |
| Tests | Jest (unit), Playwright (e2e) |
| Styling | SCSS + CSS variables, styled-components |
| Git Integration | `dugite` (Git wrapper) |

---

## Repository Structure

```
GitHubDesktop/
├── app/                    # Main application code
│   ├── src/
│   │   ├── lib/           # Core logic (Git, stores, utilities)
│   │   ├── ui/            # React components
│   │   ├── models/        # Data models
│   │   └── main-process/  # Electron main process
│   ├── styles/            # Global SCSS
│   └── test/              # Unit + e2e tests
├── script/                # Build, package, and dev scripts
├── docs/                  # Documentation
│   ├── contributing/      # Setup guides (macOS, Windows, Linux)
│   ├── technical/         # Architecture docs
│   └── superpowers/specs/ # Design specs
├── vendor/                # Native dependencies (desktop-notifications, etc.)
└── .github/workflows/     # CI/CD
```

---

## Development Environment

### Prerequisites (Ubuntu)

```bash
sudo apt install -y libsecret-1-dev libgconf-2-4
```

Also required: Node.js (match `.nvmrc`), Yarn 1.x, Python 3.9+.

### Common Commands

```bash
# Install dependencies
yarn

# Development build + hot reload
yarn build:dev && yarn start

# Production build
yarn build:prod

# Run tests
yarn test:unit
yarn test:e2e

# Lint
yarn eslint

# Package app
yarn package
```

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `development` | Synced from upstream `desktop/desktop`. Do not commit directly. |
| `feat/linux-port` | Linux-specific changes: build fixes, packaging, CI, fonts. |
| `feat/*` | Individual feature branches (SmartGit-like features, export, etc.). |
| `fix/*` | Bug fixes. |

**Workflow:**
1. Keep `development` in sync with upstream via `git fetch upstream && git merge upstream/development`.
2. Branch `feat/linux-port` from updated `development`.
3. Create feature branches from `feat/linux-port` for specific work.
4. Open PRs against `feat/linux-port`. Squash merge.

---

## Linux-Specific Notes

### Existing Linux Code

- `app/src/lib/editors/linux.ts` — External editor detection
- `app/src/lib/shells/linux.ts` — Terminal/shell integration
- `docs/contributing/setup-linux.md` — Linux dev setup

### Known Gaps

- No Linux packaging scripts (`.deb`, AppImage, Snap, Flatpak)
- No Linux CI workflows
- Some platform-gated features may need Linux equivalents

### Native Dependencies

- `keytar` → requires `libsecret-1-dev`
- `desktop-trampoline` → compiled native module
- `desktop-notifications` → may need Linux-specific build flags

---

## Code Style & Patterns

### TypeScript

- Strict mode enabled.
- Prefer `interface` over `type` for object shapes.
- Use `readonly` for immutable properties.
- No `any` without explicit justification.

### React

- Functional components + hooks.
- Class components exist in legacy code; prefer functional for new code.
- State management via internal stores in `app/src/lib/stores/`.

### Git Operations

- All Git commands go through `dugite` or helpers in `app/src/lib/git/`.
- Never shell out to `git` directly from UI components.

### Styling

- Global styles in `app/styles/ui/`.
- Component-scoped styles via `styled-components` or CSS modules.
- **Default monospace font:** JetBrains Mono (see `feat/linux-port` changes).

---

## Key Directories for Linux Work

| Directory | What Lives Here |
|-----------|-----------------|
| `app/src/lib/editors/` | External editor integrations per platform |
| `app/src/lib/shells/` | Terminal/shell integrations per platform |
| `app/src/lib/git/` | Git command wrappers |
| `script/` | Build, package, and release scripts |
| `.github/workflows/` | CI definitions |
| `docs/contributing/` | Dev setup docs |
| `docs/superpowers/specs/` | Design specifications |

---

## Testing

- **Unit:** `yarn test:unit` — Jest, fast, no Electron required.
- **E2E:** `yarn test:e2e` — Playwright, packaged app, slower.
- **Lint:** `yarn eslint` — must pass before PR merge.

---

## Upstream Sync Checklist

Before starting new work:

- [ ] `git fetch upstream`
- [ ] `git checkout development`
- [ ] `git merge upstream/development`
- [ ] `git push origin development`
- [ ] `yarn install`
- [ ] `yarn build:prod` passes
- [ ] `yarn test:unit` passes

---

## Deferred Roadmap

1. **Sub-Project 1:** Foundation (upstream sync, Linux branch, CI, JetBrains Mono)
2. **Sub-Project 2:** Linux packaging (`.deb`, AppImage, Snap, Flatpak)
3. **Sub-Project 3:** Commit history export (`.md`, `.pdf`)
4. **Sub-Project 4+:** SmartGit-like features (stash, rebase, submodules, reflog, blame, conflict tool, SSH management)

---

*Last updated: 2025-06-03*
