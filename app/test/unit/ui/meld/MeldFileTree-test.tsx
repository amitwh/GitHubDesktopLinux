import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { fireEvent, render, screen } from '../../../helpers/ui/render'
import { MeldFileTree, IMeldFileTreeProps, IMeldFile } from '../../../../src/ui/meld/MeldFileTree'

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

  // -------------------------------------------------------------------------
  // Phase 2 (T3, MeldSubmoduleView) tests
  // -------------------------------------------------------------------------

  describe('submodule rows', () => {
    const submoduleFiles: IMeldFile[] = [
      { path: 'src/a.ts', status: 'modified' },
      { path: 'vendor/lib', status: 'submodule-clean' },
      { path: 'vendor/widget', status: 'submodule-modified' },
      { path: 'vendor/legacy', status: 'submodule-uninitialized' },
    ]

    it('renders submodule paths as expandable nodes with status badges', () => {
      const { container } = render(
        <MeldFileTree
          {...defaultProps}
          files={submoduleFiles}
          submodulePaths={
            new Set(['vendor/lib', 'vendor/widget', 'vendor/legacy'])
          }
        />
      )
      assert.ok(
        container.querySelector('.meld-submodule-badge[data-submodule-status="clean"]'),
        'expected clean submodule badge'
      )
      assert.ok(
        container.querySelector('.meld-submodule-badge[data-submodule-status="modified"]'),
        'expected modified submodule badge'
      )
      assert.ok(
        container.querySelector('.meld-submodule-badge[data-submodule-status="uninitialized"]'),
        'expected uninitialized submodule badge'
      )
    })

    it('renders a toggle button with aria-expanded for each submodule', () => {
      const { container } = render(
        <MeldFileTree
          {...defaultProps}
          files={submoduleFiles}
          submodulePaths={new Set(['vendor/lib'])}
        />
      )
      const toggle = container.querySelector(
        '[data-testid="meld-submodule-toggle-vendor/lib"]'
      ) as HTMLButtonElement | null
      assert.ok(toggle, 'expected a toggle button for the submodule')
      assert.strictEqual(toggle!.getAttribute('aria-expanded'), 'false')
    })

    it('flips aria-expanded and calls onSubmoduleExpanded when toggled', () => {
      let expanded: string | null = null
      const { container } = render(
        <MeldFileTree
          {...defaultProps}
          files={submoduleFiles}
          submodulePaths={new Set(['vendor/lib'])}
          onSubmoduleExpanded={p => {
            expanded = p
          }}
        />
      )
      const toggle = container.querySelector(
        '[data-testid="meld-submodule-toggle-vendor/lib"]'
      ) as HTMLButtonElement | null
      fireEvent.click(toggle!)
      assert.strictEqual(expanded, 'vendor/lib')
      assert.strictEqual(
        toggle!.getAttribute('aria-expanded'),
        'true',
        'toggle should report expanded after first click'
      )
      // Toggle again — collapses and does not fire onSubmoduleExpanded.
      fireEvent.click(toggle!)
      assert.strictEqual(
        toggle!.getAttribute('aria-expanded'),
        'false',
        'toggle should report collapsed after second click'
      )
    })

    it('does not treat non-submodule files as submodules', () => {
      const { container } = render(<MeldFileTree {...defaultProps} />)
      assert.strictEqual(
        container.querySelectorAll('.meld-submodule-row').length,
        0,
        'expected zero submodule rows when no paths are registered'
      )
    })
  })
})
