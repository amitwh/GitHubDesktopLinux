import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { render } from '../../../helpers/ui/render'
import { MeldWindow, IMeldWindowProps } from '../../../../src/ui/meld/MeldWindow'
import { IDiff, DiffType, ITextDiff } from '../../../../src/models/diff'

const sampleTextDiff: ITextDiff = {
  kind: DiffType.Text,
  text: '@@ -1,3 +1,3 @@\n line1\n-old\n+new\n line3',
  hunks: [],
  maxLineNumber: 3,
  hasHiddenBidiChars: false,
}

describe('MeldWindow', () => {
  const defaultProps: IMeldWindowProps = {
    repositoryID: 1,
    filePath: 'src/example.ts',
    mode: 'working',
    files: [
      { path: 'src/example.ts', status: 'modified' },
      { path: 'README.md', status: 'added' },
    ],
    availableTools: [
      { id: 'meld', name: 'Meld', command: 'meld', args: '%L %R', builtIn: true },
    ],
    onGetDiff: async () => sampleTextDiff as IDiff,
    onLaunchExternalTool: async () => ({ success: true }),
    onClose: () => {},
  }

  it('renders the toolbar, file tree, and diff pane', () => {
    render(<MeldWindow {...defaultProps} />)
    // The window renders without throwing; toolbar and tree items appear
    assert.ok(document.querySelector('.meld-window'))
    assert.ok(document.querySelector('.meld-toolbar'))
    assert.ok(document.querySelector('.meld-file-tree'))
    assert.ok(document.querySelector('.meld-diff-pane'))
  })

  it('calls onGetDiff on mount with the initial file path', async () => {
    let receivedID: number | null = null
    let receivedPath: string | null = null
    let receivedMode: string | null = null
    render(
      <MeldWindow
        {...defaultProps}
        onGetDiff={async (id, path, mode) => {
          receivedID = id
          receivedPath = path
          receivedMode = mode
          return sampleTextDiff as IDiff
        }}
      />
    )
    // Allow microtasks for the async dispatch
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.strictEqual(receivedID, 1)
    assert.strictEqual(receivedPath, 'src/example.ts')
    assert.strictEqual(receivedMode, 'working')
  })
})
