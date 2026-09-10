import { DecryptionError, decryptWithKey, encryptWithKey } from './crypto'

/**
 * Holds the unwrapped data key for the lifetime of the tab, and nothing longer.
 *
 * Deliberately a module-level binding rather than React state: it must never be
 * reachable from a devtools state snapshot, a serialized render tree, or an
 * error report. It must NEVER be written to localStorage, sessionStorage,
 * IndexedDB, or a cookie — persisting it would defeat the entire design.
 */
let dataKey: CryptoKey | null = null

export class VaultLockedError extends Error {
  constructor() {
    super('No encryption key in memory — the user must log in again')
    this.name = 'VaultLockedError'
  }
}

export function setDataKey(key: CryptoKey): void {
  dataKey = key
}

export function clearDataKey(): void {
  dataKey = null
}

export function hasDataKey(): boolean {
  return dataKey !== null
}

export function getDataKey(): CryptoKey {
  if (!dataKey) throw new VaultLockedError()
  return dataKey
}

export async function encrypt(plaintext: string): Promise<string> {
  return encryptWithKey(plaintext, getDataKey())
}

export async function decrypt(envelope: string): Promise<string> {
  return decryptWithKey(envelope, getDataKey())
}

export { DecryptionError }
