/* eslint-disable no-sync */

import * as cp from 'child_process'
import * as path from 'path'
import * as electronInstaller from 'electron-winstaller'
import { getProductName, getCompanyName } from '../app/package-info'
import {
  getDistPath,
  getOSXZipPath,
  getWindowsIdentifierName,
  getWindowsStandaloneName,
  getWindowsInstallerName,
  shouldMakeDelta,
  getUpdatesURL,
  isPublishable,
  getBundleSizes,
  getDistRoot,
  getDistArchitecture,
  getIconDirectory,
} from './dist-info'
import { isGitHubActions } from './build-platforms'
import { existsSync, rmSync, writeFileSync } from 'fs'
import { getVersion } from '../app/package-info'
import { computeBundleHashSync } from '../app/src/lib/compute-bundle-hash'
import { rename } from 'fs/promises'
import { join } from 'path'
import { assertNonNullable } from '../app/src/lib/fatal-error'

const distPath = getDistPath()
const productName = getProductName()
const outputDir = getDistRoot()

const assertExistsSync = (path: string) => {
  if (!existsSync(path)) {
    throw new Error(`Expected ${path} to exist`)
  }
}

// Guard: only run the packaging dispatch when package.ts is the entry
// point (via `yarn package` / `ts-node script/package.ts`). When imported
// by other scripts (e.g. fix-deb-permissions.ts imports fixDebPermissions),
// the top-level dispatch must NOT fire.
if (require.main === module) {
  if (process.platform === 'darwin') {
    packageOSX()
  } else if (process.platform === 'win32') {
    packageWindows()
  } else if (process.platform === 'linux') {
    packageLinux()
  } else {
    console.error(`I don't know how to package for ${process.platform} :(`)
    process.exit(1)
  }

  console.log('Writing bundle size info…')
  writeFileSync(
    path.join(getDistRoot(), 'bundle-size.json'),
    JSON.stringify(getBundleSizes())
  )

  console.log('Writing bundle hash…')
  writeFileSync(
    path.join(getDistRoot(), 'bundle-hash.json'),
    JSON.stringify({
      bundleHash: computeBundleHashSync(path.join(__dirname, '..', 'out')),
    })
  )
} // end require.main === module

function packageOSX() {
  const dest = getOSXZipPath()
  rmSync(dest, { recursive: true, force: true })

  console.log('Packaging for macOS…')
  cp.execSync(
    `ditto -ck --keepParent "${distPath}/${productName}.app" "${dest}"`
  )
}

function packageWindows() {
  const iconSource = join(getIconDirectory(), 'icon-logo.ico')

  if (!existsSync(iconSource)) {
    console.error(`expected setup icon not found at location: ${iconSource}`)
    process.exit(1)
  }

  const splashScreenPath = path.resolve(
    __dirname,
    '../app/static/logos/win32-installer-splash.gif'
  )

  if (!existsSync(splashScreenPath)) {
    console.error(
      `expected setup splash screen gif not found at location: ${splashScreenPath}`
    )
    process.exit(1)
  }

  const iconUrl = 'https://desktop.githubusercontent.com/app-icon.ico'

  const nugetPkgName = getWindowsIdentifierName()
  const options: electronInstaller.Options = {
    name: nugetPkgName,
    appDirectory: distPath,
    outputDirectory: outputDir,
    authors: getCompanyName(),
    iconUrl: iconUrl,
    setupIcon: iconSource,
    loadingGif: splashScreenPath,
    exe: `${nugetPkgName}.exe`,
    title: productName,
    setupExe: getWindowsStandaloneName(),
    setupMsi: getWindowsInstallerName(),
  }

  if (shouldMakeDelta()) {
    const url = new URL(getUpdatesURL())
    // Make sure Squirrel.Windows isn't affected by partially or completely
    // disabled releases.
    url.searchParams.set('bypassStaggeredRelease', '1')
    options.remoteReleases = url.toString()
  }

  if (isGitHubActions() && isPublishable()) {
    assertNonNullable(process.env.RUNNER_TEMP, 'Missing RUNNER_TEMP env var')

    const acsPath = join(process.env.RUNNER_TEMP, 'acs')
    const dlibPath = join(acsPath, 'bin', 'x64', 'Azure.CodeSigning.Dlib.dll')

    assertExistsSync(dlibPath)

    const metadataPath = join(acsPath, 'metadata.json')
    const acsMetadata = {
      Endpoint: 'https://wus3.codesigning.azure.net/',
      CodeSigningAccountName: 'GitHubInc',
      CertificateProfileName: 'GitHubInc',
      CorrelationId: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    }
    writeFileSync(metadataPath, JSON.stringify(acsMetadata))

    options.signWithParams = `/v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 /dlib "${dlibPath}" /dmdf "${metadataPath}"`
  }

  console.log('Packaging for Windows…')
  electronInstaller
    .createWindowsInstaller(options)
    .then(() => console.log(`Installers created in ${outputDir}`))
    .then(async () => {
      // electron-winstaller (more specifically Squirrel.Windows) doesn't let
      // us control the name of the nuget packages but we want them to include
      // the architecture similar to how the setup exe and msi do so we'll just
      // have to rename them here after the fact.
      const arch = getDistArchitecture()
      const prefix = `${getWindowsIdentifierName()}-${getVersion()}`

      for (const kind of shouldMakeDelta() ? ['full', 'delta'] : ['full']) {
        const from = join(outputDir, `${prefix}-${kind}.nupkg`)
        const to = join(outputDir, `${prefix}-${arch}-${kind}.nupkg`)

        console.log(`Renaming ${from} to ${to}`)
        await rename(from, to)
      }
    })
    .catch(e => {
      console.error(`Error packaging: ${e}`)
      process.exit(1)
    })
}

function packageLinux() {
  // The prepackaged binary inside `distPath` is already named
  // `GithubDesktopLinux` (via `getExecutableName()`), so no rename is needed.
  // Previously we hardcoded `desktop` and renamed it post-prepack — that
  // rename was easy to skip when invoking electron-builder directly via the
  // `package:linux` npm script, which produced .deb files whose postinst
  // referenced a non-existent binary path.

  console.log('Packaging for Linux with electron-builder…')
  cp.execSync(
    `yarn electron-builder --linux deb AppImage snap --prepackaged ${distPath} --publish never`,
    { stdio: 'inherit' }
  )

  fixDebPermissions(outputDir)

  console.log(`Linux packages created in ${outputDir}`)
}

/**
 * Fix permission issues inside the generated .deb that electron-builder
 * gets wrong on Linux:
 *
 * 1. `.desktop` file ships as 0664 (group-writable). GNOME/gio refuses
 *    to trust group-writable desktop files ("Unable to load application
 *    information"), so the app never appears in the GNOME app grid.
 *    Fix: chmod 644 in the data tarball.
 *
 * 2. The `/opt/<productName>/` directory ships as 0700 (root-only).
 *    Non-root users can't traverse into it, so the app can't be launched
 *    even when the .desktop file is correct.  Worse, dpkg does NOT apply
 *    directory permission changes on upgrade — so even a fixed .deb
 *    installed over a previous broken install keeps the old 0700 mode.
 *    Fix: chmod 755 in the data tarball AND add an explicit chmod in
 *    the postinst (belt and suspenders for upgrades).
 *
 * 3. The postinst's `chrome-sandbox` chmod is conditional on an
 *    `unshare --user` test. On Ubuntu 23.10+ that test succeeds even
 *    though AppArmor blocks Electron's sandbox at runtime, so the
 *    postinst sets 0755 instead of the required SUID 4755. The renderer
 *    then FATAL-crashes ("No usable sandbox!") leaving a blank window.
 *    Fix: patch postinst to unconditionally chmod 4755.
 *
 * 4. `chrome-sandbox` may be missing from the prepackaged dir entirely
 *    (electron-packager wipes it, and the re-staging step in build.ts
 *    may not have fired if `yarn package:linux` was run standalone).
 *    Fix: inject it from node_modules/electron/dist if absent.
 *
 * This is exported so it can be called from `script/fix-deb-permissions.ts`
 * (the standalone post-build script chained after `yarn package:linux`).
 */
export function fixDebPermissions(outputDir: string) {
  const debName = `GithubDesktopLinux_${getVersion()}_amd64.deb`
  const debPath = path.join(outputDir, debName)
  if (!existsSync(debPath)) {
    console.warn(`.deb not found at ${debPath} — skipping permission fix.`)
    return
  }

  console.log(
    'Fixing .deb permissions (.desktop → 644, /opt dirs → 755, chrome-sandbox inject, postinst patches)…'
  )
  const tempDir = path.join(outputDir, 'deb-fix-temp')
  cp.execSync(`rm -rf "${tempDir}"`)
  cp.execSync(`dpkg-deb -R "${debPath}" "${tempDir}"`)

  const productName = getProductName()
  const optDir = path.join(tempDir, 'opt', productName)

  // 1. .desktop file: 644 (GNOME refuses group-writable entries).
  const desktopFile = path.join(
    tempDir,
    'usr/share/applications/GithubDesktopLinux.desktop'
  )
  if (existsSync(desktopFile)) {
    cp.execSync(`chmod 644 "${desktopFile}"`)
  }

  // 2. /opt dir + all subdirs: 755 (electron-builder packs as 0700).
  if (existsSync(optDir)) {
    cp.execSync(`find "${optDir}" -type d -exec chmod 755 {} +`)
  }

  // 3. Inject chrome-sandbox if missing (electron-packager may have wiped it).
  const sandboxDest = path.join(optDir, 'chrome-sandbox')
  if (!existsSync(sandboxDest)) {
    const sandboxSrc = path.join(
      __dirname,
      '..',
      'node_modules',
      'electron',
      'dist',
      'chrome-sandbox'
    )
    if (existsSync(sandboxSrc)) {
      const { copyFileSync, chmodSync } = require('fs')
      copyFileSync(sandboxSrc, sandboxDest)
      chmodSync(sandboxDest, 0o755)
      console.log('  ✓ Injected chrome-sandbox into .deb')
    } else {
      console.warn('  ⚠ chrome-sandbox not found in node_modules/electron/dist')
    }
  }

  // 4. Patch postinst: SUID 4755 + explicit dir chmod (dpkg ignores dir
  //    permission changes on upgrade, so the postinst must enforce them).
  const postinstPath = path.join(tempDir, 'DEBIAN', 'postinst')
  if (existsSync(postinstPath)) {
    patchPostinst(postinstPath, productName)
  }

  // Repack. --root-owner-group ensures files are owned by root:root
  // inside the .deb regardless of the build user's uid/gid.
  cp.execSync(
    `dpkg-deb --root-owner-group -b "${tempDir}" "${debPath}"`,
    { stdio: 'inherit' }
  )
  cp.execSync(`rm -rf "${tempDir}"`)
  console.log('.deb permissions fixed.')
}

/**
 * Patch the generated postinst to:
 *  - Replace the unreliable unshare-conditional chrome-sandbox chmod with
 *    an unconditional SUID 4755.
 *  - Add explicit chmod 755 for the /opt dir tree (dpkg preserves old dir
 *    modes on upgrade, so a previous 0700 install stays 0700 without this).
 */
function patchPostinst(postinstPath: string, productName: string) {
  const { readFileSync, writeFileSync } = require('fs')
  let original = readFileSync(postinstPath, 'utf8')
  let changed = false

  // --- Fix 1: Replace the unshare-conditional chrome-sandbox chmod ---
  const suidBlock = /# Check if user namespaces[\s\S]*?chmod 0?755 '\/opt\/[^']*\/chrome-sandbox' \|\| true\nfi/

  if (suidBlock.test(original)) {
    const replacement = `# Always set chrome-sandbox SUID 4755. On Ubuntu 23.10+ AppArmor\n# blocks unprivileged user namespaces even though \`unshare --user\`\n# succeeds, so the old conditional left chrome-sandbox at 0755 and\n# Electron's renderer FATAL-crashed ("No usable sandbox!").\nchmod 4755 '/opt/${productName}/chrome-sandbox' || true`
    original = original.replace(suidBlock, replacement)
    changed = true
    console.log('  ✓ Patched postinst: chrome-sandbox → unconditional SUID 4755')
  } else {
    console.warn(
      '  ⚠ Could not find chrome-sandbox conditional in postinst — skipping SUID patch.'
    )
  }

  // --- Fix 2: Add explicit dir chmod after update-alternatives ---
  // dpkg does NOT apply directory permission changes on upgrade, so a
  // previous install with 0700 on /opt/<productName>/ stays 0700. Inject
  // an explicit chmod right after the update-alternatives block.
  const dirChmodSnippet = `
# Fix /opt directory permissions (dpkg ignores dir-mode changes on upgrade;
# electron-builder packs as 0700, which prevents non-root users from
# traversing into the install dir to execute the binary).
chmod 755 '/opt/${productName}' || true
find '/opt/${productName}' -type d -exec chmod 755 {} + || true
`

  if (!original.includes("find '/opt/" + productName + "' -type d")) {
    // Insert right after the update-alternatives block (before the
    // chrome-sandbox chmod or before update-mime-database).
    const insertPoint = original.indexOf('\n# Check if user namespaces')
    const altInsertPoint = original.indexOf('\n# Always set chrome-sandbox')
    const mimeInsertPoint = original.indexOf(
      '\nif hash update-mime-database'
    )

    const anchor = Math.max(insertPoint, altInsertPoint, mimeInsertPoint)
    if (anchor > -1) {
      original =
        original.slice(0, anchor) +
        '\n' + dirChmodSnippet +
        original.slice(anchor)
      changed = true
      console.log('  ✓ Patched postinst: explicit chmod 755 for /opt dir tree')
    }
  }

  if (changed) {
    writeFileSync(postinstPath, original)
  }
}
