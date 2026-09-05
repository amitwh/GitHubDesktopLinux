import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { MeldEditorPane } from '../../../../src/ui/meld/MeldEditorPane'

describe('MeldEditorPane', () => {
  it('renders the title in the header', () => {
    const { container } = render(
      <MeldEditorPane
        side="left"
        title="Original (HEAD)"
        content="hello"
        originalContent="hello"
        readOnly={false}
        hasChanges={false}
        onChange={() => undefined}
        onSave={() => undefined}
        onDiscard={() => undefined}
      />
    )
    const title = container.querySelector('.meld-editor-pane-title')!
    assert.strictEqual(title.textContent, 'Original (HEAD)')
  })

  it('shows the dirty indicator when hasChanges is true', () => {
    const { container } = render(
      <MeldEditorPane
        side="left"
        title="left"
        content="edited"
        originalContent="original"
        readOnly={false}
        hasChanges={true}
        onChange={() => undefined}
        onSave={() => undefined}
        onDiscard={() => undefined}
      />
    )
    const dirty = container.querySelector('.meld-editor-pane-dirty')
    assert.ok(dirty !== null, 'expected a dirty indicator')
  })

  it('hides the dirty indicator when hasChanges is false', () => {
    const { container } = render(
      <MeldEditorPane
        side="right"
        title="right"
        content="same"
        originalContent="same"
        readOnly={false}
        hasChanges={false}
        onChange={() => undefined}
        onSave={() => undefined}
        onDiscard={() => undefined}
      />
    )
    const dirty = container.querySelector('.meld-editor-pane-dirty')
    assert.strictEqual(dirty, null, 'expected no dirty indicator')
  })

  it('disables Save and Discard when hasChanges is false', () => {
    const { container } = render(
      <MeldEditorPane
        side="left"
        title="left"
        content="x"
        originalContent="x"
        readOnly={false}
        hasChanges={false}
        onChange={() => undefined}
        onSave={() => undefined}
        onDiscard={() => undefined}
      />
    )
    const save = container.querySelector(
      'button[data-testid="save-left"]'
    ) as HTMLButtonElement
    const discard = container.querySelector(
      'button[data-testid="discard-left"]'
    ) as HTMLButtonElement
    assert.strictEqual(save.disabled, true)
    assert.strictEqual(discard.disabled, true)
  })

  it('disables Save and Discard when readOnly is true', () => {
    const { container } = render(
      <MeldEditorPane
        side="right"
        title="right"
        content="x"
        originalContent="y"
        readOnly={true}
        hasChanges={true}
        onChange={() => undefined}
        onSave={() => undefined}
        onDiscard={() => undefined}
      />
    )
    const save = container.querySelector(
      'button[data-testid="save-right"]'
    ) as HTMLButtonElement
    assert.strictEqual(save.disabled, true)
  })

  it('calls onSave with the side when Save is clicked', () => {
    let captured: 'left' | 'right' | null = null
    const { container } = render(
      <MeldEditorPane
        side="left"
        title="left"
        content="x"
        originalContent="y"
        readOnly={false}
        hasChanges={true}
        onChange={() => undefined}
        onSave={s => {
          captured = s
        }}
        onDiscard={() => undefined}
      />
    )
    fireEvent.click(
      container.querySelector('button[data-testid="save-left"]') as HTMLElement
    )
    assert.strictEqual(captured, 'left')
  })

  it('calls onDiscard with the side when Discard is clicked', () => {
    let captured: 'left' | 'right' | null = null
    const { container } = render(
      <MeldEditorPane
        side="right"
        title="right"
        content="x"
        originalContent="y"
        readOnly={false}
        hasChanges={true}
        onChange={() => undefined}
        onSave={() => undefined}
        onDiscard={s => {
          captured = s
        }}
      />
    )
    fireEvent.click(
      container.querySelector(
        'button[data-testid="discard-right"]'
      ) as HTMLElement
    )
    assert.strictEqual(captured, 'right')
  })

  it('debounces onChange calls (does not fire synchronously)', () => {
    let callCount = 0
    const { container } = render(
      <MeldEditorPane
        side="left"
        title="left"
        content=""
        originalContent=""
        readOnly={false}
        hasChanges={false}
        onChange={() => {
          callCount++
        }}
        onSave={() => undefined}
        onDiscard={() => undefined}
      />
    )
    const textarea = container.querySelector(
      'textarea[data-testid="editor-left"]'
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'first' } })
    // Synchronously, onChange should not have been called yet (debounce)
    assert.strictEqual(callCount, 0)
  })

  it('flushed change is sent on Save (even if debounce has not fired)', () => {
    let lastValue: string | null = null
    const { container } = render(
      <MeldEditorPane
        side="left"
        title="left"
        content=""
        originalContent=""
        readOnly={false}
        hasChanges={true}
        onChange={(_s, v) => {
          lastValue = v
        }}
        onSave={() => undefined}
        onDiscard={() => undefined}
      />
    )
    const textarea = container.querySelector(
      'textarea[data-testid="editor-left"]'
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'edited text' } })
    fireEvent.click(
      container.querySelector('button[data-testid="save-left"]') as HTMLElement
    )
    assert.strictEqual(lastValue, 'edited text')
  })

  it('renders a line-number gutter with one number per content line', () => {
    const { container } = render(
      <MeldEditorPane
        side="left"
        title="left"
        content={'one\ntwo\nthree'}
        originalContent="one\ntwo\nthree"
        readOnly={false}
        hasChanges={false}
        onChange={() => undefined}
        onSave={() => undefined}
        onDiscard={() => undefined}
      />
    )
    const gutter = container.querySelector('pre[data-testid="gutter-left"]')!
    assert.strictEqual(gutter.textContent, '1\n2\n3')
  })

  it('marks the wrapper with the correct side and readOnly data attributes', () => {
    const { container } = render(
      <MeldEditorPane
        side="right"
        title="right"
        content="x"
        originalContent="x"
        readOnly={true}
        hasChanges={false}
        onChange={() => undefined}
        onSave={() => undefined}
        onDiscard={() => undefined}
      />
    )
    const wrapper = container.querySelector('.meld-editor-pane')!
    assert.strictEqual(wrapper.getAttribute('data-side'), 'right')
    assert.strictEqual(wrapper.getAttribute('data-readonly'), 'true')
  })
})
