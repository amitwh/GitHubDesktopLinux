/**
 * Standalone entry point for fixing .deb permission issues after
 * electron-builder finishes. Chained after `yarn package:linux` in
 * package.json so the fix runs even when bypassing `script/package.ts`.
 *
 * See `fixDebPermissions()` in package.ts for what and why.
 */
import { fixDebPermissions } from './package'
import { getDistRoot } from './dist-info'

fixDebPermissions(getDistRoot())
