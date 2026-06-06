import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { fireEvent, render, screen } from '../../../helpers/ui/render'
import { MeldToolbar, IMeldToolbarProps } from '../../../../src/ui/meld/MeldToolbar'
import { IExternalTool } from '../../../../src/models/external-tool'

describe('MeldToolbar', () => {
  const tools: IExternalTool[] = [
    { id: 'meld', name: 'Meld', command: 'meld', args: '%L %R', builtIn: true },
    { id: 'kdiff3', name: 'KDiff3', command: 'kdiff3', args: '%L %R', builtIn: true },
  ]

  const defaultProps: IMeldToolbarProps = {
    repositoryName: 'my-repo',
    filePath: 'src/example.ts',
    filter: 'all',
    mode: 'side-by-side',
    availableTools: tools,
    onFilterChanged: () => {},
    onModeChanged: () => {},
    onExternalToolLaunched: () => {},
  }

  it('renders the repository name and file path', () => {
    render(<MeldToolbar {...defaultProps} />)
    assert.ok(screen.getByText('my-repo'))
    assert.ok(screen.getByText('src/example.ts'))
  })

  it('calls onFilterChanged when filter dropdown changes', () => {
    let received: string | null = null
    render(
      <MeldToolbar
        {...defaultProps}
        onFilterChanged={f => {
          received = f
        }}
      />
    )
    const select = screen.getByLabelText(/filter/i) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'changes' } })
    assert.strictEqual(received, 'changes')
  })

  it('calls onModeChanged when mode toggle changes', () => {
    let received: string | null = null
    render(
      <MeldToolbar
        {...defaultProps}
        onModeChanged={m => {
          received = m
        }}
      />
    )
    fireEvent.click(screen.getByLabelText(/unified/i))
    assert.strictEqual(received, 'unified')
  })

  it('renders external tool dropdown with all available tools', () => {
    render(<MeldToolbar {...defaultProps} />)
    // Open the dropdown
    fireEvent.click(screen.getByRole('button', { name: /external tool/i }))
    assert.ok(screen.getByText('Meld'))
    assert.ok(screen.getByText('KDiff3'))
  })
})
