/* eslint-disable react/jsx-no-bind */
import * as React from 'react'
import { IExternalTool } from '../../../models/external-tool'

export interface IExternalToolsSettingsProps {
  readonly tools: ReadonlyArray<IExternalTool>
  readonly onToolAdded: (tool: Omit<IExternalTool, 'id' | 'builtIn'>) => void
  readonly onToolRemoved: (toolID: string) => void
}

interface IExternalToolsSettingsState {
  readonly newToolName: string
  readonly newToolCommand: string
  readonly newToolArgs: string
}

export class ExternalToolsSettings extends React.Component<
  IExternalToolsSettingsProps,
  IExternalToolsSettingsState
> {
  public constructor(props: IExternalToolsSettingsProps) {
    super(props)
    this.state = {
      newToolName: '',
      newToolCommand: '',
      newToolArgs: '%L %R',
    }
  }

  private onAddClicked = () => {
    const { newToolName, newToolCommand, newToolArgs } = this.state
    if (newToolName.trim() === '' || newToolCommand.trim() === '') {
      return
    }
    this.props.onToolAdded({
      name: newToolName.trim(),
      command: newToolCommand.trim(),
      args: newToolArgs.trim() || '%L %R',
    })
    this.setState({
      newToolName: '',
      newToolCommand: '',
      newToolArgs: '%L %R',
    })
  }

  public render() {
    return (
      <div className="external-tools-settings">
        <h2>External diff tools</h2>
        <p>
          Add or edit the diff tools you can launch from the Meld window. Use{' '}
          <code>%L</code> for the left/old path, <code>%R</code> for the
          right/new path, and <code>%B</code> for the base path (3-way merge
          only).
        </p>

        <table className="external-tools-list">
          <thead>
            <tr>
              <th>Name</th>
              <th>Command</th>
              <th>Args</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {this.props.tools.map(t => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.command}</td>
                <td>{t.args}</td>
                <td>
                  {!t.builtIn && (
                    <button
                      type="button"
                      onClick={() => this.props.onToolRemoved(t.id)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <fieldset>
          <legend>Add new tool</legend>
          <label>
            <span>Name</span>
            <input
              type="text"
              value={this.state.newToolName}
              onChange={e => this.setState({ newToolName: e.target.value })}
              aria-label="Tool name"
            />
          </label>
          <label>
            <span>Command</span>
            <input
              type="text"
              value={this.state.newToolCommand}
              onChange={e => this.setState({ newToolCommand: e.target.value })}
              aria-label="Tool command"
              placeholder="e.g. meld or /usr/local/bin/meld"
            />
          </label>
          <label>
            <span>Args</span>
            <input
              type="text"
              value={this.state.newToolArgs}
              onChange={e => this.setState({ newToolArgs: e.target.value })}
              aria-label="Tool args"
              placeholder="%L %R"
            />
          </label>
          <button type="button" onClick={this.onAddClicked}>
            Add tool
          </button>
        </fieldset>
      </div>
    )
  }
}
