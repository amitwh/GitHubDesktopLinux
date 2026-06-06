import * as React from 'react'

export type IFileStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'untracked'
  | 'renamed'

export interface IMeldFile {
  readonly path: string
  readonly status: IFileStatus
}

export interface IMeldFileTreeProps {
  readonly files: ReadonlyArray<IMeldFile>
  readonly selectedPath: string | null
  readonly onFileSelected: (path: string) => void
}

export class MeldFileTree extends React.Component<IMeldFileTreeProps, {}> {
  public render() {
    return (
      <div className="meld-file-tree" role="tree" aria-label="Changed files">
        {this.props.files.map(f => (
          <div
            key={f.path}
            role="treeitem"
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
        ))}
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
  }
}
