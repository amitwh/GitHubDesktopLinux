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

Linux is not officially supported; however, you can find installers created for Linux from a fork of GitHub Desktop in the [Community Releases](https://github.com/desktop/desktop#community-releases) section.

## What's different from upstream GitHub Desktop?

[GitHub Desktop Linux](https://github.com/amitwh/GitHubDesktop) is an unofficial, community-maintained Linux fork maintained by [Amit Haridas](https://github.com/amitwh). It is not affiliated with or endorsed by GitHub, Inc. All credit for the original GitHub Desktop application goes to GitHub, Inc. and the upstream contributors.

This fork adds the following enhancements on top of upstream GitHub Desktop:

- **Native Linux packaging** — `.deb`, AppImage, Snap, and Flatpak targets. The `.deb` and AppImage build out of the box; Flatpak requires the `flatpak` CLI on the build host to produce a usable artifact.
- **Meld-style diff viewer** — a standalone `BrowserWindow` with side-by-side, unified, and 3-way merge views, in-place editing, character-level word diff, copy-left/copy-right controls, and conflict resolution. Phases 1a (read-only), 1b (editable), 1c (3-way merge), 2 (stash/reflog/submodule views), and 3 (rebase preview) have shipped.
- **Worktree housekeeping and safety** — lock/unlock, prune, dirty-state warnings on delete, disk-usage display, and an auto-prune preference, built on top of upstream worktree support.
- **Commit history export** — export the commit history of any repository to Markdown, then convert it with [pandoc](https://pandoc.org/) to PDF, DOCX, HTML, and other formats.
- **Linux font and UX** — JetBrains Mono is the default monospace font, and platform-gated features have been audited for Linux.
- **Power-user menu additions** — View toggles for word wrap and line numbers, a Layout Reset action, and a Linux-only top-level **Tools** menu (Open Configuration Folder, Open Logs Folder, Reload, Toggle Developer Tools, Reveal Diagnostics Folder). The **Repository** menu gains Cherry-pick, Stash Changes, Compare with Previous, Discard All Working Tree Changes, Clean Untracked Files, plus a Reset-to-HEAD submenu with explicit `--soft`/`--mixed`/`--hard` mode selection and a Revert HEAD Commit item.
- **New Preferences tabs** — Meld/Diff Tools (default-diff/merge/fallback toggles), Shell (terminal dropdown, confirm-to-open, open-on-repo-open), Performance (hardware acceleration, smooth scrolling, fetch interval, perf tracing), and Diagnostics (platform info, log directory reveal, Git binary path, issue reporter). Six additional persisted preferences wire through to the existing `AppStore` load/save flow.
- **Copy SHA / Copy Path / Copy commit URL** — completes the context-menu clipboard surface so every commit row and every file row in Changes / History exposes the obvious copy actions.

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
