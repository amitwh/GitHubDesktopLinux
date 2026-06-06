/* eslint-disable react/jsx-no-bind */
import * as React from 'react'
import { IExternalTool } from '../../models/external-tool'

export type IMeldFilter = 'all' | 'changes' | 'identical' | 'untracked'
export type IMeldMode = 'side-by-side' | 'unified'
export type IMeldEditMode = 'view' | 'edit'

export interface IMeldToolbarProps {
  readonly repositoryName: string
  readonly filePath: string
  readonly filter: IMeldFilter
  readonly mode: IMeldMode
  readonly editMode: IMeldEditMode
  readonly availableTools: ReadonlyArray<IExternalTool>
  readonly onFilterChanged: (filter: IMeldFilter) => void
  readonly onModeChanged: (mode: IMeldMode) => void
  readonly onEditModeChanged: (mode: IMeldEditMode) => void
  readonly onExternalToolLaunched: (tool: IExternalTool) => void
}

interface IMeldToolbarState {
  readonly toolDropdownOpen: boolean
}

export class MeldToolbar extends React.Component<IMeldToolbarProps, IMeldToolbarState> {
  public constructor(props: IMeldToolbarProps) {
    super(props)
    this.state = { toolDropdownOpen: false }
  }

  private onToolClicked = (tool: IExternalTool) => {
    this.setState({ toolDropdownOpen: false })
    this.props.onExternalToolLaunched(tool)
  }

  public render() {
    const { repositoryName, filePath, filter, mode, editMode, availableTools } = this.props
    return (
      <div className="meld-toolbar" role="toolbar" aria-label="Meld toolbar">
        <span className="meld-toolbar-repository">{repositoryName}</span>
        <span className="meld-toolbar-separator" aria-hidden="true">
          /
        </span>
        <span className="meld-toolbar-file">{filePath}</span>

        <div className="meld-toolbar-edit-toggle" role="radiogroup" aria-label="Edit mode">
          <button
            type="button"
            role="radio"
            aria-checked={editMode === 'view'}
            onClick={() => this.props.onEditModeChanged('view')}
            data-testid="edit-mode-view"
          >
            View
          </button>
          <button
            type="button"
            role="radio"
            aria-label="Edit"
            aria-checked={editMode === 'edit'}
            onClick={() => this.props.onEditModeChanged('edit')}
            data-testid="edit-mode-edit"
          >
            Edit
          </button>
        </div>

        <label className="meld-toolbar-field">
          <span>Filter:</span>
          <select
            value={filter}
            onChange={e =>
              this.props.onFilterChanged(e.target.value as IMeldFilter)
            }
            aria-label="Filter"
          >
            <option value="all">Show all</option>
            <option value="changes">Show changes</option>
            <option value="identical">Show identical</option>
            <option value="untracked">Show untracked</option>
          </select>
        </label>

        <div
          className="meld-toolbar-mode-toggle"
          role="radiogroup"
          aria-label="Diff mode"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'side-by-side'}
            aria-label="Side-by-side"
            onClick={() => this.props.onModeChanged('side-by-side')}
          >
            Side-by-side
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'unified'}
            aria-label="Unified"
            onClick={() => this.props.onModeChanged('unified')}
          >
            Unified
          </button>
        </div>

        <div className="meld-toolbar-external-tool">
          <button
            type="button"
            onClick={() =>
              this.setState({ toolDropdownOpen: !this.state.toolDropdownOpen })
            }
            aria-haspopup="true"
            aria-expanded={this.state.toolDropdownOpen}
          >
            External tool ▾
          </button>
          {this.state.toolDropdownOpen && (
            <ul className="meld-toolbar-tool-list" role="menu">
              {availableTools.map(t => (
                <li key={t.id} role="menuitem">
                  <button type="button" onClick={() => this.onToolClicked(t)}>
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }
}
