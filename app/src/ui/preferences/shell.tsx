import * as React from 'react'
import { DialogContent } from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Select } from '../lib/select'
import { Shell as AppShell } from '../../lib/shells'

interface IShellProps {
  readonly availableShells: ReadonlyArray<AppShell>
  readonly selectedShell: AppShell | null
  readonly confirmShellOpen: boolean
  readonly openShellOnRepoOpen: boolean
  readonly customShellPath: string | null
  readonly onSelectedShellChanged: (shell: AppShell) => void
  readonly onConfirmShellOpenChanged: (value: boolean) => void
  readonly onOpenShellOnRepoOpenChanged: (value: boolean) => void
  readonly onCustomShellPathChanged: (value: string) => void
}

// eslint-disable-next-line no-restricted-syntax
export default class Shell extends React.Component<IShellProps> {
  private onSelectedShellChanged = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    this.props.onSelectedShellChanged(event.currentTarget.value as AppShell)
  }

  private onConfirmShellOpenChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onConfirmShellOpenChanged(event.currentTarget.checked)
  }

  private onOpenShellOnRepoOpenChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onOpenShellOnRepoOpenChanged(event.currentTarget.checked)
  }

  private onCustomShellPathChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onCustomShellPathChanged(event.currentTarget.value)
  }

  public render() {
    const detectedShell = this.props.availableShells[0]

    return (
      <DialogContent>
        <h2>Shell</h2>
        <div className="advanced-section">
          <h2>Currently detected shell</h2>
          <p className="settings-description">
            {detectedShell ?? 'No shell detected'}
          </p>
          <Select
            label="Shell to use"
            value={this.props.selectedShell ?? ''}
            onChange={this.onSelectedShellChanged}
          >
            {this.props.availableShells.map(shell => (
              <option key={shell} value={shell}>
                {shell}
              </option>
            ))}
            <option value="custom">Custom</option>
          </Select>
          {this.props.selectedShell === ('custom' as AppShell) && (
            <label>
              Custom shell path
              <input
                type="text"
                value={this.props.customShellPath ?? ''}
                onChange={this.onCustomShellPathChanged}
              />
            </label>
          )}
        </div>
        <div className="advanced-section">
          <Checkbox
            label="Always confirm before opening shell"
            value={
              this.props.confirmShellOpen
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onConfirmShellOpenChanged}
          />
        </div>
        <div className="advanced-section">
          <Checkbox
            label="Open shell on repository open"
            value={
              this.props.openShellOnRepoOpen
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onOpenShellOnRepoOpenChanged}
          />
        </div>
      </DialogContent>
    )
  }
}
