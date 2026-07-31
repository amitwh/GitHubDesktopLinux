# [GitHub Desktop](https://desktop.github.com)

[GitHub Desktop](https://desktop.github.com/) is an open-source [Electron](https://www.electronjs.org/)-based
GitHub app. It is written in [TypeScript](https://www.typescriptlang.org) and
uses [React](https://reactjs.org/).

<picture>
  <source
    srcset="https://user-images.githubusercontent.com/634063/202742848-63fa1488-6254-49b5-af7c-96a6b50ea8af.png"
    media="(prefers-color-scheme: dark)"
  />
  <img
    width="1072"
    src="https://user-images.githubusercontent.com/634063/202742985-bb3b3b94-8aca-404a-8d8a-fd6a6f030672.png"
    alt="A screenshot of the GitHub Desktop application showing changes being viewed and committed with two attributed co-authors"
  />
</picture>

## Where can I get it?

Download the official installer for your operating system:

 - [macOS](https://central.github.com/deployments/desktop/desktop/latest/darwin)
 - [macOS (Apple silicon)](https://central.github.com/deployments/desktop/desktop/latest/darwin-arm64)
 - [Windows](https://central.github.com/deployments/desktop/desktop/latest/win32)
 - [Windows machine-wide install](https://central.github.com/deployments/desktop/desktop/latest/win32?format=msi)

### Linux (this fork)

Linux is not officially supported by upstream GitHub Desktop. **This fork** ships native packages for every common Linux distribution, hosted publicly at [`amitwh/GitHubDesktopLinux-releases`](https://github.com/amitwh/GitHubDesktopLinux-releases/releases/latest):

 - **AppImage** — portable single-file, runs on every distro without install
 - **Debian / Ubuntu `.deb`** — installs as `githubdesktoplinux`, integrates with the system package manager
 - **Snap** — universal Linux package, runs confined under snapd
 - **Flatpak** — sandboxed Linux package, runs under Flatpak

All four targets are published on every release. Auto-update does not run for the fork — re-download or re-install when you want to switch.

```sh
# Debian / Ubuntu (e.g., Ubuntu 22.04+)
curl -L https://github.com/amitwh/GitHubDesktopLinux-releases/releases/latest/download/GithubDesktopLinux_3.6.4-beta1-linux3_amd64.deb \
  -o /tmp/github-desktop.deb && sudo apt install /tmp/github-desktop.deb

# Portable AppImage
curl -L https://github.com/amitwh/GitHubDesktopLinux-releases/releases/latest/download/GithubDesktopLinux-3.6.4-beta1-linux3.AppImage \
  -o ~/bin/github-desktop && chmod +x ~/bin/github-desktop
```

### Windows (this fork)

The fork also ships an **unsigned Windows installer** named **GitHub Desktop Plus** on the same [`amitwh/GitHubDesktopLinux-releases`](https://github.com/amitwh/GitHubDesktopLinux-releases/releases/latest) mirror. Because it is not Authenticode-signed, Windows SmartScreen will warn on first launch — click **More info → Run anyway** to install. See [`docs/contributing/windows-build.md`](./docs/contributing/windows-build.md) for full details, the build pipeline, and the SmartScreen workaround.

- **Squirrel `.exe` installer** — installs to `%LocalAppData%\GitHubDesktopPlus`, registers uninstall entry, auto-updates in-place.
- **Standalone `.zip`** — portable, no installer, useful for locked-down environments or USB-stick installs.
- **x64 and ARM64** — both architectures ship per release.

```sh
# Debian / Ubuntu (e.g., Ubuntu 22.04+)
curl -L https://github.com/amitwh/GitHubDesktopLinux-releases/releases/latest/download/GithubDesktopLinux_3.6.4-beta1-linux3_amd64.deb \
  -o /tmp/github-desktop.deb && sudo apt install /tmp/github-desktop.deb

# Portable AppImage
curl -L https://github.com/amitwh/GitHubDesktopLinux-releases/releases/latest/download/GithubDesktopLinux-3.6.4-beta1-linux3.AppImage \
  -o ~/bin/github-desktop && chmod +x ~/bin/github-desktop
```

## What's different from upstream GitHub Desktop?

[GitHub Desktop Linux](https://github.com/amitwh/GitHubDesktop) is an unofficial, community-maintained Linux fork maintained by [Amit Haridas](https://github.com/amitwh). It is not affiliated with or endorsed by GitHub, Inc. All credit for the original GitHub Desktop application goes to GitHub, Inc. and the upstream contributors. See the in-app **About** dialog for the same attribution block.

The fork consists of upstream `desktop/desktop` plus the following enhancements, organized by area:

### 🐧 Linux packaging

- **`.deb`** — Debian / Ubuntu. Installs to `/opt/GitHub Desktop/`, registers `~/.local/bin/GithubDesktopLinux` via `update-alternatives`, and includes Electron's setuid sandbox helper for hardened-kernel deployments.
- **AppImage** — portable, single-file, runs on every distro without root.
- **Snap** — published under classic confinement so it can reach the user's home directory and run `git` operations on the host filesystem.
- **Flatpak** — runs under `org.freedesktop.Platform 23.08` + Electron's BaseApp extension with `--filesystem=host` and secret-service portal access for the credential store.
- **Linux-only top-level `Tools` menu** — Open Configuration Folder (user-data root), Open Logs Folder (rotating file logs), Reload Window, Toggle Developer Tools, Reveal Diagnostics Folder.

### 🪟 Windows fork (GitHub Desktop Plus)

- **Same installer packaging path as upstream** — Squirrel-based `.exe` + standalone `.zip`, produced by `electron-winstaller` on a real `windows-2022` runner (no Wine, no cross-compile fragility).
- **Built on every push to `linux` / `feat/linux-port`** — see `.github/workflows/ci-windows.yml`. Reusable via `workflow_call` from `.github/workflows/release-mirror.yml` when `target=windows` or `target=both`.
- **Product name `GitHub Desktop Plus`** — switched via the `DESKTOP_BUILD_TARGET=windows` env-var in `app/package-info.ts`. Linux build default unchanged.
- **Unsigned installer** — Windows SmartScreen warns on first run. Authenticode signing is planned for a future spec; the SmartScreen workaround is one extra click for users.

### 🔍 Diff / merge

- **Standalone Meld-style diff viewer** in its own `BrowserWindow`. Side-by-side, unified, and 3-way merge views; in-place editing; character-level word diff; copy-left / copy-right controls; safe-mode for read-only inspection. Phases 1a (read-only), 1b (editable), 1c (3-way merge), 2 (stash/reflog/submodule views), and 3 (rebase preview) have shipped.
- **Per-line blame gutter** in the editable side-by-side view — author + 7-char SHA next to each right-side line, click-to-open-commit, hover tooltip with full message.
- **External diff-tool launcher registry** — list pre-installed `meld`, `kdiff3`, `beyond-compare`, `vscode`, and pick the default per file type from Preferences → Meld / Diff Tools.

### 🌿 Worktrees

- **Lock / unlock** linked worktrees with a single right-click — keeps them from accidental pruning.
- **Prune** linked worktrees via the worktree list and via a top-level menu item.
- **Dirty-state warnings** when deleting a worktree with uncommitted changes (in-app confirmation dialog).
- **Disk-usage display** per worktree in the dropdown.
- **Auto-prune preference** — automatically prunes stale worktrees when a repository is opened.
- **`worktree:compute-sizes` IPC** — main-process disk-usage computation with bounded concurrency.

### 🛠 Repository workflow

- **View menu** — Toggle Word Wrap (diff editor + commit message), Toggle Line Numbers (diff editor), Reset Layout (restore default panel widths). All three are persisted preferences.
- **File menu (Linux-only)** — `Open Recent ▸` submenu (dynamically populated from `recentRepositories` via IPC, up to 10 entries, "No recent repositories" placeholder when empty) and `Close Repository` (`CmdOrCtrl+W`) for clearing the active repo without removing it from the recent list.
- **Repository menu** — five new git operations backed by new `lib/git/` wrappers and 15 unit tests:
  - **Cherry-pick Commit…** — invokes the existing cherry-pick infrastructure.
  - **Stash Changes…** — timestamped stash message.
  - **Compare with Previous Commit** (`CmdOrCtrl+Alt+P`) — opens Meld for HEAD vs HEAD~1 via `getPreviousCommitSha`.
  - **Discard All Working Tree Changes…** — `git checkout -- .` via `lib/git/discard.ts`.
  - **Clean Untracked Files…** — `git clean -fd` via `lib/git/clean.ts`.
  - **Reset to HEAD…** submenu — three mode shortcuts:
    - **Soft** — keep changes staged ( `--soft HEAD~1`).
    - **Mixed** — keep changes unstaged (`HEAD~1`).
    - **Hard** — discard all working changes (`--hard HEAD~1`).
  - **Revert HEAD Commit** — invokes the existing `revertCommit` dispatcher; gated on `hasMultipleCommits`.
- **Compare Current Branch with…** (`CmdOrCtrl+Alt+W`) — auto-opens the compare view against the repo's default branch or the most-recent local branch; falls back to the BranchList filter if neither is available.

### ⚙️ Settings

Four new Preferences tabs (Preferences → …):

- **Git → Cloning** — Use SSH for new clones (`git@github.com` prefix).
- **Advanced → Fetching** — Automatically fetch when the window regains focus.
- **Meld / Diff Tools** — Always use Meld for 2-file diffs, Use Meld for conflict resolution, Fall back to inline diff when Meld is unavailable. Shows the detected Meld binary path (`which meld`).
- **Shell** — Active shell dropdown (gnome-terminal / konsole / xterm / custom), Always confirm before opening shell, Open shell on repository open.
- **Performance** — Disable hardware acceleration (requires restart), Smooth list scrolling, Limit concurrent git operations to 4, Background fetch interval (5/15/30/60 min), Enable performance tracing.
- **Diagnostics** — Read-only platform info (Electron / Chrome / Node version, OS, arch), log directory path with Open-folder and Copy-path actions, Git binary path, app version, link to the upstream issue tracker.

11 new persisted preference keys round-trip through the existing `AppStore` load/save flow. None of the existing keys were renamed or obsoleted.

### 📋 Clipboard surface (complete)

- **Copy SHA** — right-click any commit row.
- **Copy commit URL** — right-click any commit row (uses `createCommitURL` helper at `lib/commit-url.ts`; gated on `gitHubRepository` and non-local commits).
- **Copy branch name** — right-click any branch row.
- **Copy tag** / **Copy tags** — right-click any commit row that carries tags.
- **Copy file path** / **Copy relative file path** — right-click any file row in Changes or in a commit's file list.
- **Open in Editor** / **Open with default program** / **Reveal in file manager** — already present in upstream but re-exported across all file-list views.

### 🛡 Diagnostics & quality

- **Trace logging toggle** in Preferences → Performance; logs git calls with timing when enabled.
- **Log directory reveal** in Preferences → Diagnostics and from the top-level Tools → Open Logs Folder.
- **`createCommitURL` helper** centralises GitHub commit-URL generation so any contributor adding new "View on GitHub" affordances gets the right URL format for both `github.com` and Enterprise instances by default.
- **Chromium setuid sandbox helper** is now correctly bundled in the `.deb` postinst (fixed via the new `copyChromeSandbox()` step in `script/build.ts`), so installs on hardened kernels without user-namespaces see a working sandbox instead of an exit-on-launch failure.

### 📝 Linux-fork disclosure

The in-app **About** dialog now contains a fork-attribution block that:
- Names the fork "GitHub Desktop Linux" (distinct from upstream's "GitHub Desktop").
- States clearly that it is unofficial and community-maintained.
- Credits GitHub, Inc. as the original developer of all upstream code.
- Links to both `amitwh/GitHubDesktop` (private source) and `desktop/desktop` (upstream).

Mitigates any trademark-policy concerns from GitHub by being explicit rather than silent about the fork relationship.

### Beta Channel

Want to test out new features and get fixes before everyone else? Install the
beta channel to get access to early builds of Desktop:

 - [macOS](https://central.github.com/deployments/desktop/desktop/latest/darwin?env=beta)
 - [macOS (Apple silicon)](https://central.github.com/deployments/desktop/desktop/latest/darwin-arm64?env=beta)
 - [Windows](https://central.github.com/deployments/desktop/desktop/latest/win32?env=beta)
 - [Windows (ARM64)](https://central.github.com/deployments/desktop/desktop/latest/win32-arm64?env=beta)

The release notes for the latest beta versions are available [here](https://desktop.github.com/release-notes/?env=beta).

### Past Releases
You can find past releases at https://desktop.githubusercontent.com. After installation of a past version, the auto update functionality will attempt to download the latest version. 

### Community Releases

There are several community-supported package managers that can be used to
install GitHub Desktop:
 - Windows users can install using [winget](https://docs.microsoft.com/en-us/windows/package-manager/winget/) `c:\> winget install github-desktop` or [Chocolatey](https://chocolatey.org/) `c:\> choco install github-desktop`
 - macOS users can install using [Homebrew](https://brew.sh/) package manager:
      `$ brew install --cask github`

Installers for various Linux distributions can be found on the
[`shiftkey/desktop`](https://github.com/shiftkey/desktop) fork.

## Is GitHub Desktop right for me? What are the primary areas of focus?

[This document](https://github.com/desktop/desktop/blob/development/docs/process/what-is-desktop.md) describes the focus of GitHub Desktop and who the product is most useful for.

## I have a problem with GitHub Desktop

Note: The [GitHub Desktop Code of Conduct](https://github.com/desktop/desktop/blob/development/CODE_OF_CONDUCT.md) applies in all interactions relating to the GitHub Desktop project.

First, please search the [open issues](https://github.com/desktop/desktop/issues?q=is%3Aopen)
and [closed issues](https://github.com/desktop/desktop/issues?q=is%3Aclosed)
to see if your issue hasn't already been reported (it may also be fixed).

There is also a list of [known issues](https://github.com/desktop/desktop/blob/development/docs/known-issues.md)
that are being tracked against Desktop, and some of these issues have workarounds.

If you can't find an issue that matches what you're seeing, open a [new issue](https://github.com/desktop/desktop/issues/new/choose),
choose the right template and provide us with enough information to investigate
further.

## The issue I reported isn't fixed yet. What can I do?

If nobody has responded to your issue in a few days, you're welcome to respond to it with a friendly ping in the issue. Please do not respond more than a second time if nobody has responded. The GitHub Desktop maintainers are constrained in time and resources, and diagnosing individual configurations can be difficult and time consuming. While we'll try to at least get you pointed in the right direction, we can't guarantee we'll be able to dig too deeply into any one person's issue.

## How can I contribute to GitHub Desktop?

The [CONTRIBUTING.md](./.github/CONTRIBUTING.md) document will help you get setup and
familiar with the source. The [documentation](docs/) folder also contains more
resources relevant to the project.

If you're looking for something to work on, check out the [help wanted](https://github.com/desktop/desktop/issues?q=is%3Aissue+is%3Aopen+label%3A%22help%20wanted%22) label.

## Building Desktop

To setup your development environment for building Desktop, check out: [`setup.md`](./docs/contributing/setup.md).

## More Resources

See [desktop.github.com](https://desktop.github.com) for more product-oriented
information about GitHub Desktop.

See our [getting started documentation](https://docs.github.com/en/desktop/overview/getting-started-with-github-desktop) for more information on how to set up, authenticate, and configure GitHub Desktop.

## License

**[MIT](LICENSE)**

The MIT license grant is not for GitHub's trademarks, which include the logo
designs. GitHub reserves all trademark and copyright rights in and to all
GitHub trademarks. GitHub's logos include, for instance, the stylized
Invertocat designs that include "logo" in the file title in the following
folder: [logos](app/static/logos).

GitHub® and its stylized versions and the Invertocat mark are GitHub's
Trademarks or registered Trademarks. When using GitHub's logos, be sure to
follow the GitHub [logo guidelines](https://github.com/logos).
