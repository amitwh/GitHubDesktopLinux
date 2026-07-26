export { MeldWindow } from './MeldWindow'
export type { IMeldWindowProps, IMeldWindowMode } from './MeldWindow'
// Phase 2 (T2, MeldStashView): list of stashes as expandable tree nodes
export { MeldStashView } from './MeldStashView'
export type { IMeldStashViewProps } from './MeldStashView'
export { MeldFileTree } from './MeldFileTree'
export type {
  IMeldFile,
  IMeldFileTreeProps,
  IFileStatus,
} from './MeldFileTree'
export { MeldDiffPane } from './MeldDiffPane'
export type { IMeldDiffPaneProps } from './MeldDiffPane'
export { MeldToolbar } from './MeldToolbar'
export type {
  IMeldToolbarProps,
  IMeldFilter,
  IMeldMode,
  IMeldEditMode,
} from './MeldToolbar'
export { MeldEditorPane } from './MeldEditorPane'
export type { IMeldEditorPaneProps } from './MeldEditorPane'
export { MeldCharDiff } from './MeldCharDiff'
export type { IMeldCharDiffProps } from './MeldCharDiff'
export { MeldCopyButtons } from './MeldCopyButtons'
export type { IMeldCopyButtonsProps } from './MeldCopyButtons'
// Phase 1c: three-way merge components
export { MeldThreeWayView } from './MeldThreeWayView'
export type { IMeldThreeWayViewProps } from './MeldThreeWayView'
export { MeldMergedPane } from './MeldMergedPane'
export type { IMeldMergedPaneProps } from './MeldMergedPane'
export { MeldMergeControls } from './MeldMergeControls'
export type { IMeldMergeControlsProps } from './MeldMergeControls'
// Phase 2 (T1, BlameGutter): per-line git blame attribution
export { MeldBlameGutter } from './MeldBlameGutter'
export type { IMeldBlameGutterProps } from './MeldBlameGutter'
export { ExternalToolsSettings } from './settings/ExternalToolsSettings'
export type { IExternalToolsSettingsProps } from './settings/ExternalToolsSettings'
