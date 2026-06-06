import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { fireEvent, render, screen } from '../../../helpers/ui/render'
import { MeldFileTree, IMeldFileTreeProps } from '../../../../src/ui/meld/MeldFileTree'

describe('MeldFileTree', () => {
  const defaultProps: IMeldFileTreeProps = {
    files: [
      { path: 'src/a.ts', status: 'modified' },
      { path: 'src/b.ts', status: 'added' },
      { path: 'README.md', status: 'deleted' },
    ],
    selectedPath: null,
    onFileSelected: () => {},
  }

  it('renders all files', () => {
    render(<MeldFileTree {...defaultProps} />)
    assert.ok(screen.getByText('src/a.ts'), 'src/a.ts should render')
    assert.ok(screen.getByText('src/b.ts'), 'src/b.ts should render')
    assert.ok(screen.getByText('README.md'), 'README.md should render')
  })

  it('calls onFileSelected when a file is clicked', () => {
    let selectedPath: string | null = null
    render(
      <MeldFileTree
        {...defaultProps}
        onFileSelected={path => {
          selectedPath = path
        }}
      />
    )
    fireEvent.click(screen.getByText('src/a.ts'))
    assert.strictEqual(selectedPath, 'src/a.ts')
  })

  it('highlights the selected file via data-selected', () => {
    const { container } = render(
      <MeldFileTree {...defaultProps} selectedPath="src/a.ts" />
    )
    const selectedRow = container.querySelector('[data-selected="true"]')
    assert.ok(selectedRow, 'should have a selected row')
    assert.ok(selectedRow!.textContent!.includes('src/a.ts'))
  })

  it('shows change status via data-status attribute', () => {
    const { container } = render(<MeldFileTree {...defaultProps} />)
    assert.ok(container.querySelector('[data-status="modified"]'))
    assert.ok(container.querySelector('[data-status="added"]'))
    assert.ok(container.querySelector('[data-status="deleted"]'))
  })
})
