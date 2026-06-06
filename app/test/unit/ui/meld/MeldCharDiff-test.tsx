import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { render } from '@testing-library/react'
import { MeldCharDiff } from '../../../../src/ui/meld/MeldCharDiff'
import { ICharDiffPart } from '../../../../src/lib/meld/diffOperations'

describe('MeldCharDiff', () => {
  it('renders a single equal part with no data-diff attribute markers', () => {
    const parts: ReadonlyArray<ICharDiffPart> = [{ value: 'hello' }]
    const { container } = render(<MeldCharDiff parts={parts} />)
    const span = container.querySelector('.meld-char-diff-equal')
    assert.ok(span !== null, 'expected a .meld-char-diff-equal span')
    assert.strictEqual(span!.textContent, 'hello')
  })

  it('renders an added part with the .meld-char-diff-added class', () => {
    const parts: ReadonlyArray<ICharDiffPart> = [
      { value: 'hello ' },
      { value: 'world', added: true },
    ]
    const { container } = render(<MeldCharDiff parts={parts} />)
    const added = container.querySelector('.meld-char-diff-added')
    assert.ok(added !== null, 'expected a .meld-char-diff-added span')
    assert.strictEqual(added!.textContent, 'world')
  })

  it('renders a removed part with the .meld-char-diff-removed class', () => {
    const parts: ReadonlyArray<ICharDiffPart> = [
      { value: 'hello ' },
      { value: 'old', removed: true },
      { value: 'new' },
    ]
    const { container } = render(<MeldCharDiff parts={parts} />)
    const removed = container.querySelector('.meld-char-diff-removed')
    assert.ok(removed !== null, 'expected a .meld-char-diff-removed span')
    assert.strictEqual(removed!.textContent, 'old')
  })

  it('renders all three types in the right order', () => {
    const parts: ReadonlyArray<ICharDiffPart> = [
      { value: 'a' },
      { value: 'b', added: true },
      { value: 'c' },
      { value: 'd', removed: true },
    ]
    const { container } = render(<MeldCharDiff parts={parts} />)
    const wrapper = container.querySelector('.meld-char-diff')!
    assert.strictEqual(wrapper.textContent, 'abcd')
    const ordered = Array.from(
      container.querySelectorAll('[data-diff]')
    ).map(el => el.getAttribute('data-diff'))
    assert.deepStrictEqual(ordered, ['equal', 'added', 'equal', 'removed'])
  })

  it('appends the className prop to the wrapper', () => {
    const { container } = render(
      <MeldCharDiff parts={[{ value: 'x' }]} className="extra-class" />
    )
    const wrapper = container.querySelector('.meld-char-diff')!
    assert.ok(wrapper.classList.contains('extra-class'))
  })
})
