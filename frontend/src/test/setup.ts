import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { webcrypto } from 'node:crypto'
import { afterEach } from 'vitest'

// Testing Library only auto-registers its DOM cleanup when a global afterEach
// exists, and this project runs Vitest with globals: false. Without this,
// renders accumulate across tests in a file and every query finds duplicates.
afterEach(cleanup)

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
