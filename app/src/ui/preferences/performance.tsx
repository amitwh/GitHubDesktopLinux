import * as React from 'react'
import { DialogContent } from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Select } from '../lib/select'

interface IPerformancePreferencesProps {
  readonly disableHardwareAcceleration: boolean
  readonly enableSmoothScrolling: boolean
  readonly limitConcurrentGitOps: boolean
  readonly maxBackgroundFetchInterval: number
  readonly enablePerfTracing: boolean
  readonly onDisableHardwareAccelerationChanged: (value: boolean) => void
  readonly onEnableSmoothScrollingChanged: (value: boolean) => void
  readonly onLimitConcurrentGitOpsChanged: (value: boolean) => void
  readonly onMaxBackgroundFetchIntervalChanged: (value: number) => void
  readonly onEnablePerfTracingChanged: (value: boolean) => void
}

/**
 * Curated set of background fetch intervals (in minutes) exposed in the
 * Performance preferences tab. The persisted value is loosely typed so legacy
 * entries that don't appear here still round-trip correctly through
 * `getNumber`/`setNumber`.
 */
const FetchIntervalChoices: ReadonlyArray<{ value: string }> = [
  { value: '5' },
  { value: '15' },
  { value: '30' },
  { value: '60' },
]

/**
 * Performance preferences tab. All toggles here round-trip through
 * `AppStore._setX` so changes survive an app restart, but most take effect
 * only on the next launch (hence the footer note).
 */
export class Performance extends React.Component<IPerformancePreferencesProps, {}> {
  private onDisableHardwareAccelerationChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onDisableHardwareAccelerationChanged(
      event.currentTarget.checked
    )
  }

  private onEnableSmoothScrollingChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onEnableSmoothScrollingChanged(event.currentTarget.checked)
  }

  private onLimitConcurrentGitOpsChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onLimitConcurrentGitOpsChanged(event.currentTarget.checked)
  }

  private onEnablePerfTracingChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onEnablePerfTracingChanged(event.currentTarget.checked)
  }

  private onMaxBackgroundFetchIntervalChanged = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    const parsed = parseInt(event.currentTarget.value, 10)
    const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : 15
    this.props.onMaxBackgroundFetchIntervalChanged(safe)
  }

  public render() {
    // Cast through string so the <Select> can compare values without
    // worrying about JSX type strictness.
    const fetchIntervalValue = String(this.props.maxBackgroundFetchInterval)
    const matchesChoice = FetchIntervalChoices.some(
      c => c.value === fetchIntervalValue
    )

    return (
      <DialogContent>
        <div className="advanced-section">
          <h2>Rendering</h2>
          <Checkbox
            label="Disable hardware acceleration (requires restart)"
            value={
              this.props.disableHardwareAcceleration
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onDisableHardwareAccelerationChanged}
            ariaDescribedBy="disable-hardware-acceleration-description"
          />
          <p
            id="disable-hardware-acceleration-description"
            className="settings-description"
          >
            When enabled, Electron is started with hardware acceleration
            disabled on the next launch. Useful as a recovery option when a
            faulty GPU driver crashes the renderer.
          </p>

          <Checkbox
            label="Smooth list scrolling"
            value={
              this.props.enableSmoothScrolling
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onEnableSmoothScrollingChanged}
            ariaDescribedBy="enable-smooth-scrolling-description"
          />
          <p
            id="enable-smooth-scrolling-description"
            className="settings-description"
          >
            When enabled, list virtualization tries to keep the visible rows
            mounted across the duration of a scroll gesture so the renderer
            does not show empty gaps during a fast fling.
          </p>
        </div>

        <div className="advanced-section">
          <h2>Git Operations</h2>
          <Checkbox
            label="Limit concurrent git operations to 4"
            value={
              this.props.limitConcurrentGitOps
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onLimitConcurrentGitOpsChanged}
            ariaDescribedBy="limit-concurrent-git-ops-description"
          />
          <p
            id="limit-concurrent-git-ops-description"
            className="settings-description"
          >
            When enabled, the Git operation queue caps the number of
            concurrent git processes to a small fixed number to keep large
            multi-repo workspaces responsive.
          </p>

          <Select
            label="Background fetch interval (minutes)"
            value={matchesChoice ? fetchIntervalValue : '15'}
            onChange={this.onMaxBackgroundFetchIntervalChanged}
          >
            {FetchIntervalChoices.map(c => (
              <option key={c.value} value={c.value}>
                {c.value}
              </option>
            ))}
          </Select>
        </div>

        <div className="advanced-section">
          <h2>Diagnostics</h2>
          <Checkbox
            label="Enable performance tracing"
            value={
              this.props.enablePerfTracing
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onEnablePerfTracingChanged}
            ariaDescribedBy="enable-perf-tracing-description"
          />
          <p
            id="enable-perf-tracing-description"
            className="settings-description"
          >
            When enabled, the renderer enables Chromium performance tracing
            categories useful when debugging jank.
          </p>
        </div>

        <p className="description">
          These settings take effect on next app launch.
        </p>
      </DialogContent>
    )
  }
}
