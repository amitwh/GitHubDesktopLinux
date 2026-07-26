import * as React from 'react'
import which from 'which'
import { DialogContent } from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'

interface IMeldToolsProps {
  readonly useMeldForDiff: boolean
  readonly useMeldForMerge: boolean
  readonly fallbackToInlineDiff: boolean
  readonly onUseMeldForDiffChanged: (value: boolean) => void
  readonly onUseMeldForMergeChanged: (value: boolean) => void
  readonly onFallbackToInlineDiffChanged: (value: boolean) => void
}

interface IMeldToolsState {
  readonly meldPath: string | null
  readonly isDetecting: boolean
}

// eslint-disable-next-line no-restricted-syntax
export default class MeldTools extends React.Component<
  IMeldToolsProps,
  IMeldToolsState
> {
  public state: IMeldToolsState = {
    meldPath: null,
    isDetecting: true,
  }

  public async componentDidMount() {
    const meldPath = await which('meld', { nothrow: true })
    this.setState({ meldPath, isDetecting: false })
  }

  private onUseMeldForDiffChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onUseMeldForDiffChanged(event.currentTarget.checked)
  }

  private onUseMeldForMergeChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onUseMeldForMergeChanged(event.currentTarget.checked)
  }

  private onFallbackToInlineDiffChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onFallbackToInlineDiffChanged(event.currentTarget.checked)
  }

  public render() {
    return (
      <DialogContent>
        <h2>Meld / Diff Tools</h2>
        <div className="advanced-section">
          <Checkbox
            label="Always use Meld for 2-file diffs"
            value={
              this.props.useMeldForDiff
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onUseMeldForDiffChanged}
          />
        </div>
        <div className="advanced-section">
          <Checkbox
            label="Use Meld for conflict resolution (3-way merge)"
            value={
              this.props.useMeldForMerge
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onUseMeldForMergeChanged}
          />
        </div>
        <div className="advanced-section">
          <Checkbox
            label="Fall back to inline diff when Meld is unavailable"
            value={
              this.props.fallbackToInlineDiff
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onFallbackToInlineDiffChanged}
          />
        </div>
        <div className="advanced-section">
          <h2>Detected Meld binary</h2>
          <p className="settings-description">
            {this.state.isDetecting
              ? 'Detecting Meld binary…'
              : this.state.meldPath ?? 'Meld binary not detected'}
          </p>
        </div>
      </DialogContent>
    )
  }
}
