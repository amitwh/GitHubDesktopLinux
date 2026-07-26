import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'

import { Advanced } from '../../../src/ui/preferences/advanced'
import { render, screen, fireEvent } from '../../helpers/ui/render'

describe('Advanced preferences — auto-prune worktrees', () => {
  it('renders the auto-prune checkbox in the off state when prop is false', () => {
    render(
      <Advanced
        useWindowsOpenSSH={false}
        optOutOfUsageTracking={false}
        useExternalCredentialHelper={false}
        repositoryIndicatorsEnabled={false}
        autoPruneWorktreesOnOpen={false}
        onUseWindowsOpenSSHChanged={() => {}}
        onOptOutofReportingChanged={() => {}}
        onUseExternalCredentialHelperChanged={() => {}}
        onRepositoryIndicatorsEnabledChanged={() => {}}
        onAutoPruneWorktreesOnOpenChanged={() => {}}
      />
    )

    const checkbox = screen.getByLabelText(
      /Automatically prune stale worktrees when opening a repository/
    ) as HTMLInputElement
    assert.ok(checkbox !== null)
    assert.strictEqual(checkbox.checked, false)
  })

  it('renders the auto-prune checkbox in the on state when prop is true', () => {
    render(
      <Advanced
        useWindowsOpenSSH={false}
        optOutOfUsageTracking={false}
        useExternalCredentialHelper={false}
        repositoryIndicatorsEnabled={false}
        autoPruneWorktreesOnOpen={true}
        onUseWindowsOpenSSHChanged={() => {}}
        onOptOutofReportingChanged={() => {}}
        onUseExternalCredentialHelperChanged={() => {}}
        onRepositoryIndicatorsEnabledChanged={() => {}}
        onAutoPruneWorktreesOnOpenChanged={() => {}}
      />
    )

    const checkbox = screen.getByLabelText(
      /Automatically prune stale worktrees when opening a repository/
    ) as HTMLInputElement
    assert.strictEqual(checkbox.checked, true)
  })

  it('fires onAutoPruneWorktreesOnOpenChanged when toggled', () => {
    let lastValue: boolean | undefined

    render(
      <Advanced
        useWindowsOpenSSH={false}
        optOutOfUsageTracking={false}
        useExternalCredentialHelper={false}
        repositoryIndicatorsEnabled={false}
        autoPruneWorktreesOnOpen={false}
        onUseWindowsOpenSSHChanged={() => {}}
        onOptOutofReportingChanged={() => {}}
        onUseExternalCredentialHelperChanged={() => {}}
        onRepositoryIndicatorsEnabledChanged={() => {}}
        onAutoPruneWorktreesOnOpenChanged={value => {
          lastValue = value
        }}
      />
    )

    const checkbox = screen.getByLabelText(
      /Automatically prune stale worktrees when opening a repository/
    )
    fireEvent.click(checkbox)

    assert.strictEqual(lastValue, true)
  })
})