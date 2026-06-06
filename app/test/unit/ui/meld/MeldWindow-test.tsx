import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'
import { render } from '../../../helpers/ui/render'
import { MeldWindow, IMeldWindowProps } from '../../../../src/ui/meld/MeldWindow'
import { IDiff, DiffType, ITextDiff } from '../../../../src/models/diff'
import { IThreeWayState } from '../../../../src/models/meld-merge'

const sampleTextDiff: ITextDiff = {
  kind: DiffType.Text,
  text: '@@ -1,3 +1,3 @@\n line1\n-old\n+new\n line3',
  hunks: [],
  maxLineNumber: 3,
  hasHiddenBidiChars: false,
}

const sampleThreeWayState: IThreeWayState = {
  repositoryID: 1,
  filePath: 'src/example.ts',
  baseContent: 'line1\nline2\nline3\n',
  localContent: 'line1\nmodified\nline3\n',
  remoteContent: 'line1\nline2\nremote\n',
  mergedContent:
    'line1\n<<<<<<< HEAD\nmodified\n|||||||\nline2\n=======\nremote\n>>>>>>> branch\n',
  hunks: [
    {
      baseContent: 'line2',
      localContent: 'modified',
      remoteContent: 'remote',
      startLine: 1,
      endLine: 6,
    },
  ],
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

  // -------------------------------------------------------------------------
  // Merge mode tests
  // -------------------------------------------------------------------------

  describe('merge mode', () => {
    const mergeProps: IMeldWindowProps = {
      ...defaultProps,
      mode: 'merge',
      threeWayState: sampleThreeWayState,
    }

    it('renders MeldThreeWayView, MeldMergedPane, and MeldMergeControls when threeWayState is provided', () => {
      render(<MeldWindow {...mergeProps} />)
      assert.ok(
        document.querySelector('.meld-three-way-view'),
        'MeldThreeWayView should render',
      )
      assert.ok(
        document.querySelector('.meld-merged-pane'),
        'MeldMergedPane should render',
      )
      assert.ok(
        document.querySelector('.meld-merge-controls'),
        'MeldMergeControls should render',
      )
    })

    it('shows loading state when threeWayState is undefined', () => {
      render(
        <MeldWindow
          {...mergeProps}
          threeWayState={undefined}
        />,
      )
      assert.ok(
        document.querySelector('.meld-merge-loading'),
        'Loading placeholder should render when threeWayState is missing',
      )
    })

    it('renders file tree + diff pane (not merge components) when mode is working', () => {
      render(<MeldWindow {...defaultProps} mode="working" />)
      assert.ok(
        document.querySelector('.meld-file-tree'),
        'file tree should render in working mode',
      )
      assert.ok(
        document.querySelector('.meld-diff-pane'),
        'diff pane should render in working mode',
      )
      assert.ok(
        !document.querySelector('.meld-three-way-view'),
        'three-way view should NOT render in working mode',
      )
    })

    it('calls onHunkResolved when a per-hunk resolution button is clicked', () => {
      let resolvedHunkIndex: number | null = null
      let resolvedSide: string | null = null

      render(
        <MeldWindow
          {...mergeProps}
          onHunkResolved={(_repoID, _path, hunkIndex, side) => {
            resolvedHunkIndex = hunkIndex
            resolvedSide = side
          }}
        />,
      )

      // Click "Accept LOCAL" on the first (and only) hunk action bar
      const localBtn = document.querySelector(
        '[data-testid="resolve-local-0"]',
      ) as Element | null
      assert.ok(localBtn, 'resolve-local-0 button should exist')
      localBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      assert.strictEqual(resolvedHunkIndex, 0, 'hunkIndex should be 0')
      assert.strictEqual(resolvedSide, 'local', 'side should be local')
    })

    it('updates mergedContent in state when onHunkResolved is called', async () => {
      // The onHunkResolved prop just logs; the internal state update
      // is what matters. We verify that after clicking "Accept LOCAL",
      // the textarea content reflects the resolved MERGED file.
      render(<MeldWindow {...mergeProps} />)

      const textarea = document.querySelector(
        '[data-testid="merged-textarea"]',
      ) as HTMLTextAreaElement | null
      assert.ok(textarea, 'merged textarea should exist')

      const initialValue = textarea.value

      // Click "Accept LOCAL" for the first conflict block
      const localBtn = document.querySelector(
        '[data-testid="resolve-local-0"]',
      ) as Element | null
      assert.ok(localBtn)
      localBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      // Wait for React to re-render after the state update
      await new Promise(resolve => setTimeout(resolve, 50))

      // After resolution, the conflict markers for hunk 0 should be gone
      const updatedTextarea = document.querySelector(
        '[data-testid="merged-textarea"]',
      ) as HTMLTextAreaElement | null
      assert.ok(updatedTextarea, 'textarea should still exist after re-render')
      assert.notStrictEqual(
        updatedTextarea.value,
        initialValue,
        'textarea value should change after resolving a hunk',
      )
      assert.ok(
        !updatedTextarea.value.includes('<<<<<<< HEAD'),
        'resolved hunk markers should be removed from merged content',
      )
    })

    it('calls onAutoMerge when the Auto-merge button is clicked', async () => {
      let autoMergeCalled = false

      render(
        <MeldWindow
          {...mergeProps}
          onAutoMerge={async () => {
            autoMergeCalled = true
            return { mergedContent: 'auto-merged result', clean: true }
          }}
        />,
      )

      const autoMergeBtn = document.querySelector(
        '[data-testid="meld-merge-controls-auto-merge"]',
      ) as Element | null
      assert.ok(autoMergeBtn, 'auto-merge button should exist')
      autoMergeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      await new Promise(resolve => setTimeout(resolve, 0))
      assert.ok(autoMergeCalled, 'onAutoMerge should have been called')
    })

    it('calls onMarkMergeResolved when Mark as resolved is clicked', async () => {
      let markResolvedCalled = false

      // Use a clean (no conflicts) threeWayState so the button is not disabled
      const cleanThreeWayState: IThreeWayState = {
        repositoryID: 1,
        filePath: 'src/example.ts',
        baseContent: 'line1\nline2\n',
        localContent: 'line1\nline2\n',
        remoteContent: 'line1\nline2\n',
        mergedContent: 'line1\nline2\n',
        hunks: [],
      }

      render(
        <MeldWindow
          {...mergeProps}
          threeWayState={cleanThreeWayState}
          onMarkMergeResolved={async () => {
            markResolvedCalled = true
            return { success: true }
          }}
        />,
      )

      const markBtn = document.querySelector(
        '[data-testid="meld-merge-controls-mark-resolved"]',
      ) as Element | null
      assert.ok(markBtn, 'mark-resolved button should exist')
      assert.ok(
        !(markBtn as HTMLButtonElement).disabled,
        'mark-resolved button should be enabled when no conflicts remain',
      )
      markBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      await new Promise(resolve => setTimeout(resolve, 0))
      assert.ok(markResolvedCalled, 'onMarkMergeResolved should have been called')
    })
  })
})
