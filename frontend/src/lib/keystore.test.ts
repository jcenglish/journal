import { afterEach, describe, expect, it } from 'vitest'
import { deriveCredentials, generateWrappedDataKey } from './crypto'
import {
  DecryptionError,
  VaultLockedError,
  clearDataKey,
  decrypt,
  encrypt,
  getDataKey,
  hasDataKey,
  setDataKey,
} from './keystore'

const unlock = async () => {
  const { wrapKey } = await deriveCredentials('one@example.com', 'correct horse battery', {
    iterations: 1_000,
  })
  const { dataKey } = await generateWrappedDataKey(wrapKey)
  setDataKey(dataKey)
  return dataKey
}

afterEach(() => clearDataKey())

describe('keystore', () => {
  it('starts locked', () => {
    expect(hasDataKey()).toBe(false)
    expect(() => getDataKey()).toThrow(VaultLockedError)
  })

  it('encrypts and decrypts once unlocked', async () => {
    await unlock()

    expect(hasDataKey()).toBe(true)
    expect(await decrypt(await encrypt('a private thought'))).toBe('a private thought')
  })

  // The ticket's fourth test case, at the unit level: after logout the key is
  // gone from memory and a decrypt attempt fails without re-login.
  it('cannot decrypt after the key is cleared', async () => {
    await unlock()
    const envelope = await encrypt('a private thought')

    clearDataKey()

    expect(hasDataKey()).toBe(false)
    await expect(decrypt(envelope)).rejects.toThrow(VaultLockedError)
  })

  it('cannot decrypt an envelope from a previous key after re-unlocking', async () => {
    await unlock()
    const envelope = await encrypt('a private thought')

    clearDataKey()
    await unlock() // a fresh random data key

    await expect(decrypt(envelope)).rejects.toThrow(DecryptionError)
  })

  it('never persists the key to browser storage', async () => {
    const dataKey = await unlock()
    await encrypt('a private thought')

    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(dataKey.extractable).toBe(false)
  })
})
