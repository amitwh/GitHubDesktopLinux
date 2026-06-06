export { substituteArgs, ISubstituteArgsInput } from './external-tool-args'
export { getDefaultExternalTools } from './default-tools'
export {
  computeCharDiff,
  copyHunk,
  revertEdits,
  applyEdit,
  ICharDiffPart,
  IHunkRange,
} from './diffOperations'
export { MeldSessionPersistence } from './sessionPersistence'
// Phase 1c: three-way conflict marker parsing + hunk resolution
export {
  parseConflictMarkers,
  synthesizeMerge,
  applyHunkResolution,
  buildConflictHunks,
} from './conflictMarkers'
