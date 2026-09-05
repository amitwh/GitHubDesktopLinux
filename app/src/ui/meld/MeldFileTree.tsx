/* eslint-disable react/jsx-no-bind */
import * as React from 'react'

export type IFileStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'untracked'
  | 'renamed'
  | 'submodule-clean'
  | 'submodule-modified'
  | 'submodule-uninitialized'

export interface IMeldFile {
  readonly path: string
  readonly status: IFileStatus
}

export interface IMeldFileTreeProps {
  readonly files: ReadonlyArray<IMeldFile>
  readonly selectedPath: string | null
  readonly onFileSelected: (path: string) => void
  /**
   * Phase 2 (T3, MeldSubmoduleView): when provided, file paths
   * matching any entry in this set are rendered as expandable
   * submodule nodes with a status badge. The badge colour and
   * letter come from the status field of `IMeldFile`. Expanding
   * the node calls `onSubmoduleExpanded(path)`. This is optional
   * for backward compatibility with existing call sites that
   * don't yet pass submodule metadata.
   */
  readonly submodulePaths?: ReadonlySet<string>
  readonly onSubmoduleExpanded?: (path: string) => void
}

interface IMeldFileTreeState {
  readonly expanded: ReadonlySet<string>
}

/**
 * Phase 1a file tree sidebar. In Phase 2 (T3, MeldSubmoduleView)
 * the tree also detects submodule paths and renders them as
 * expandable nodes with a status badge:
 *
 *   - clean → green "S" badge
 *   - modified → orange "S+" badge
 *   - uninitialized → red "S-" badge
 *
 * Non-submodule files render exactly as before. The component
 * stays presentational; it doesn't know about git or fetch
 * submodule contents. Expanding a submodule triggers
 * `onSubmoduleExpanded(path)` so the parent can route the diff
 * through `MeldDiffPane` or an external tool.
 */
export class MeldFileTree extends React.Component<
  IMeldFileTreeProps,
  IMeldFileTreeState
> {
  public constructor(props: IMeldFileTreeProps) {
    super(props)
    this.state = { expanded: new Set<string>() }
  }

  private isSubmodule(path: string): boolean {
    const set = this.props.submodulePaths
    return set !== undefined && set.has(path)
  }

  private toggleExpanded = (path: string) => {
    const next = new Set(this.state.expanded)
    if (next.has(path)) {
      next.delete(path)
    } else {
      next.add(path)
      const cb = this.props.onSubmoduleExpanded
      if (cb !== undefined) {
        cb(path)
      }
    }
    this.setState({ expanded: next })
  }

  public render() {
    return (
      <div className="meld-file-tree" role="tree" aria-label="Changed files">
        {this.props.files.map(f => this.renderRow(f))}
      </div>
    )
  }

  private renderRow(f: IMeldFile) {
    if (this.isSubmodule(f.path)) {
      return this.renderSubmoduleRow(f)
    }
    return (
      <div
        key={f.path}
        role="treeitem"
        aria-selected={this.props.selectedPath === f.path}
        data-selected={this.props.selectedPath === f.path}
        data-status={f.status}
        onClick={() => this.props.onFileSelected(f.path)}
        className="meld-file-tree-row"
        aria-label={`${f.path}, ${f.status}`}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            this.props.onFileSelected(f.path)
          }
        }}
      >
        <span
          className={`meld-file-status meld-file-status-${f.status}`}
          aria-hidden="true"
        >
          {statusIcon(f.status)}
        </span>
        <span className="meld-file-path">{f.path}</span>
      </div>
    )
  }

  private renderSubmoduleRow(f: IMeldFile) {
    const isExpanded = this.state.expanded.has(f.path)
    return (
      <div
        key={f.path}
        role="treeitem"
        aria-selected={this.props.selectedPath === f.path}
        data-selected={this.props.selectedPath === f.path}
        data-status={f.status}
        data-testid={`meld-submodule-row-${f.path}`}
        className="meld-file-tree-row meld-submodule-row"
        aria-label={`Submodule ${f.path}, ${submoduleStatusLabel(f.status)}`}
      >
        <button
          type="button"
          className="meld-submodule-toggle"
          aria-expanded={isExpanded}
          data-testid={`meld-submodule-toggle-${f.path}`}
          onClick={() => this.toggleExpanded(f.path)}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} submodule ${
            f.path
          }`}
        >
          <span className="meld-submodule-caret" aria-hidden="true">
            {isExpanded ? '▾' : '▸'}
          </span>
        </button>
        <span
          className={`meld-file-status meld-file-status-${f.status} meld-submodule-badge`}
          data-submodule-status={submoduleStatusKey(f.status)}
          aria-hidden="true"
        >
          {submoduleBadgeLetter(f.status)}
        </span>
        <span
          className="meld-file-path"
          onClick={() => this.props.onFileSelected(f.path)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              this.props.onFileSelected(f.path)
            }
          }}
          tabIndex={0}
          role="button"
        >
          {f.path}
        </span>
      </div>
    )
  }
}

function statusIcon(status: IFileStatus): string {
  switch (status) {
    case 'modified':
      return 'M'
    case 'added':
      return 'A'
    case 'deleted':
      return 'D'
    case 'untracked':
      return '?'
    case 'renamed':
      return 'R'
    case 'submodule-clean':
      return 'S'
    case 'submodule-modified':
      return 'S+'
    case 'submodule-uninitialized':
      return 'S-'
  }
}

function submoduleStatusKey(status: IFileStatus): string {
  switch (status) {
    case 'submodule-clean':
      return 'clean'
    case 'submodule-modified':
      return 'modified'
    case 'submodule-uninitialized':
      return 'uninitialized'
    default:
      return ''
  }
}

function submoduleStatusLabel(status: IFileStatus): string {
  switch (status) {
    case 'submodule-clean':
      return 'clean'
    case 'submodule-modified':
      return 'modified'
    case 'submodule-uninitialized':
      return 'uninitialized'
    default:
      return status
  }
}

function submoduleBadgeLetter(status: IFileStatus): string {
  switch (status) {
    case 'submodule-clean':
      return 'S'
    case 'submodule-modified':
      return 'S+'
    case 'submodule-uninitialized':
      return 'S-'
    default:
      return 'S'
  }
}
