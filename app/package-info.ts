import { bundleID, companyName, productName, version } from './package.json'

/**
 * Returns the Windows-build product name when the build is targeting Windows,
 * otherwise the value declared in app/package.json (with the standard
 * `-dev` suffix applied in development mode).
 *
 * The Windows fork is shipped as `GitHub Desktop Plus` to clearly distinguish
 * it from GitHub's official Windows build, while keeping the About dialog's
 * fork attribution as the authoritative disclosure. Triggered by setting
 * `DESKTOP_BUILD_TARGET=windows` at build time — set by ci-windows.yml and
 * by the Windows job in release-mirror.yml.
 */
export function getProductName() {
  if (process.env.DESKTOP_BUILD_TARGET === 'windows') {
    return 'GitHub Desktop Plus'
  }
  return process.env.NODE_ENV === 'development'
    ? `${productName}-dev`
    : productName
}

export function getCompanyName() {
  return companyName
}

export function getVersion() {
  return version
}

export function getBundleID() {
  return process.env.NODE_ENV === 'development' ? `${bundleID}Dev` : bundleID
}
