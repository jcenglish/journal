import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { webcrypto } from 'node:crypto'
import { afterEach } from 'vitest'

// Testing Library only auto-registers its DOM cleanup when a global afterEach
// exists, and this project runs Vitest with globals: false. Without this,
// renders accumulate across tests in a file and every query finds duplicates.
afterEach(cleanup)

// Autosave drafts live in localStorage, which jsdom keeps for the whole file.
afterEach(() => localStorage.clear())

// jsdom implements only crypto.getRandomValues and crypto.randomUUID — there is
// no SubtleCrypto, which the whole encryption layer depends on. It also installs
// `crypto` as a getter with no setter, so a plain assignment throws in a module;
// defineProperty is the way in (the IDL getter is configurable).
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto as unknown as Crypto,
    configurable: true,
    writable: true,
  })
}

// jsdom has no layout engine, so it omits the geometry APIs ProseMirror (under
// TipTap) calls when it scrolls a selection into view. Empty geometry is
// enough for typing and commands; it just can't measure anything.
const emptyRect = () => new DOMRect(0, 0, 0, 0)
const emptyRectList = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
Range.prototype.getClientRects ??= emptyRectList
Range.prototype.getBoundingClientRect ??= emptyRect
Element.prototype.getClientRects ??= emptyRectList
document.elementFromPoint ??= () => null

// jsdom's <dialog> showModal()/close() are no-ops that never toggle the `open`
// attribute, so a dialog-based modal never becomes queryable in tests without this.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}
