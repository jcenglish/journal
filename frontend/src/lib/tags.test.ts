import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deriveCredentials, encryptWithKey, generateWrappedDataKey } from './crypto'
import { decryptTag, encryptTagContent, InvalidTagError } from './tags'
import { clearDataKey, setDataKey } from './keystore'

let dataKey: CryptoKey

beforeEach(async () => {
  const { wrapKey } = await deriveCredentials('one@example.com', 'correct horse battery', { iterations: 1_000 })
  dataKey = (await generateWrappedDataKey(wrapKey)).dataKey
  setDataKey(dataKey)
})

afterEach(() => {
  clearDataKey()
})

describe('encryptTagContent', () => {
  it('encrypts a trimmed name so no plaintext is sent', async () => {
    const envelope = await encryptTagContent('  gratitude  ')

    expect(envelope).not.toContain('gratitude')
    expect(envelope).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('rejects a blank name before encrypting', async () => {
    await expect(encryptTagContent('   ')).rejects.toThrow(InvalidTagError)
  })
})

describe('decryptTag', () => {
  it('round-trips content and color', async () => {
    const content = await encryptWithKey('gratitude', dataKey)

    expect(await decryptTag({ id: 1, content, color: '#2563eb', created_at: '2026-01-01T00:00:00.000Z' })).toEqual({
      id: 1,
      content: 'gratitude',
      color: '#2563eb',
    })
  })

  it('marks a tag that will not decrypt as unreadable instead of throwing', async () => {
    const otherKey = (
      await generateWrappedDataKey(
        (await deriveCredentials('two@example.com', 'another password', { iterations: 1_000 })).wrapKey,
      )
    ).dataKey
    const content = await encryptWithKey('not yours', otherKey)

    expect(await decryptTag({ id: 1, content, color: '#2563eb', created_at: '2026-01-01T00:00:00.000Z' })).toEqual({
      id: 1,
      content: '',
      color: '#2563eb',
      unreadable: true,
    })
  })
})
