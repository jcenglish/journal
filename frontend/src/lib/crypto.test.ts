import { describe, expect, it } from 'vitest'
import {
  DecryptionError,
  PBKDF2_ITERATIONS,
  decryptWithKey,
  deriveCredentials,
  encryptWithKey,
  generateWrappedDataKey,
  normalizeEmail,
  unwrapDataKey,
} from './crypto'

// 600k iterations is ~0.5-1s per call, which would make this suite crawl. Unit
// tests use a cheap count; one test below covers the real constant.
const FAST = { iterations: 1_000 }

const derive = (email: string, password: string) => deriveCredentials(email, password, FAST)

describe('normalizeEmail', () => {
  it('strips and downcases, matching the Rails User model', () => {
    expect(normalizeEmail('  New@Example.COM  ')).toBe('new@example.com')
  })
})

describe('deriveCredentials', () => {
  it('is deterministic for the same email and password', async () => {
    const a = await derive('one@example.com', 'correct horse battery')
    const b = await derive('one@example.com', 'correct horse battery')

    expect(a.authHash).toBe(b.authHash)
  })

  // The silent-data-loss guard: the server normalizes the email, so if the client
  // didn't, these two would authenticate identically but derive different keys.
  it('normalizes the email before salting', async () => {
    const padded = await derive('  One@Example.COM  ', 'correct horse battery')
    const plain = await derive('one@example.com', 'correct horse battery')

    expect(padded.authHash).toBe(plain.authHash)
  })

  it('strips unicode whitespace, which Ruby String#strip leaves behind', async () => {
    const nbsp = await derive('one@example.com\u00A0', 'correct horse battery')
    const plain = await derive('one@example.com', 'correct horse battery')

    expect(normalizeEmail('one@example.com\u00A0')).toBe('one@example.com')
    expect(nbsp.authHash).toBe(plain.authHash)
  })

  it('differs for a different password', async () => {
    const a = await derive('one@example.com', 'correct horse battery')
    const b = await derive('one@example.com', 'correct horse battary')

    expect(a.authHash).not.toBe(b.authHash)
  })

  it('differs for a different email', async () => {
    const a = await derive('one@example.com', 'correct horse battery')
    const b = await derive('two@example.com', 'correct horse battery')

    expect(a.authHash).not.toBe(b.authHash)
  })

  // bcrypt silently truncates past 72 bytes. Base64 of 32 bytes is 44 chars, so
  // this pins the encoding before someone swaps in hex (96 chars) and loses entropy.
  it('produces a 44-character auth hash, comfortably under bcrypt 72-byte limit', async () => {
    const { authHash } = await derive('one@example.com', 'correct horse battery')

    expect(authHash).toHaveLength(44)
    expect(new TextEncoder().encode(authHash).byteLength).toBeLessThan(72)
  })

  // Without this, an `iterations` option that was silently ignored would still
  // pass every other test in this file.
  it('actually applies the iteration count', async () => {
    const cheap = await deriveCredentials('one@example.com', 'correct horse battery', {
      iterations: 1_000,
    })
    const dearer = await deriveCredentials('one@example.com', 'correct horse battery', {
      iterations: 2_000,
    })

    expect(cheap.authHash).not.toBe(dearer.authHash)
  })

  it('produces a non-extractable wrapping key', async () => {
    const { wrapKey } = await derive('one@example.com', 'correct horse battery')

    expect(wrapKey.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', wrapKey)).rejects.toThrow()
  })

  it('derives a usable key at the real iteration count', async () => {
    const { wrapKey, authHash } = await deriveCredentials('one@example.com', 'correct horse battery')

    expect(authHash).toHaveLength(44)
    expect(await decryptWithKey(await encryptWithKey('hello', wrapKey), wrapKey)).toBe('hello')
  }, 30_000)
})

describe('data key wrapping', () => {
  // The keys are non-extractable, so "same password gives the same key" can't be
  // asserted by comparing key material. Round-tripping across two independent
  // derivations is the assertion that actually matters.
  it('unwraps with a key derived separately from the same credentials', async () => {
    const first = await derive('one@example.com', 'correct horse battery')
    const { dataKey, blob } = await generateWrappedDataKey(first.wrapKey)

    const second = await derive('one@example.com', 'correct horse battery')
    const unwrapped = await unwrapDataKey(blob, second.wrapKey)

    const envelope = await encryptWithKey('a private thought', dataKey)

    expect(await decryptWithKey(envelope, unwrapped)).toBe('a private thought')
  })

  it('refuses to unwrap with a key derived from the wrong password', async () => {
    const right = await derive('one@example.com', 'correct horse battery')
    const wrong = await derive('one@example.com', 'wrong horse battery')
    const { blob } = await generateWrappedDataKey(right.wrapKey)

    await expect(unwrapDataKey(blob, wrong.wrapKey)).rejects.toThrow(DecryptionError)
  })

  it('produces a non-extractable data key', async () => {
    const { wrapKey } = await derive('one@example.com', 'correct horse battery')
    const { dataKey } = await generateWrappedDataKey(wrapKey)

    expect(dataKey.extractable).toBe(false)
  })
})

describe('encryptWithKey / decryptWithKey', () => {
  const key = async () => (await derive('one@example.com', 'correct horse battery')).wrapKey

  it('round-trips a string', async () => {
    const k = await key()

    expect(await decryptWithKey(await encryptWithKey('hello', k), k)).toBe('hello')
  })

  it('round-trips multi-byte unicode', async () => {
    const k = await key()
    const text = 'Feeling steady today 🌤 — ありがとう'

    expect(await decryptWithKey(await encryptWithKey(text, k), k)).toBe(text)
  })

  it('round-trips a ProseMirror-shaped JSON document', async () => {
    const k = await key()
    const doc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rough morning.' }] }],
    })

    expect(await decryptWithKey(await encryptWithKey(doc, k), k)).toBe(doc)
  })

  it('produces a different envelope each time (random IV)', async () => {
    const k = await key()

    expect(await encryptWithKey('hello', k)).not.toBe(await encryptWithKey('hello', k))
  })

  it('rejects a tampered ciphertext (GCM authentication)', async () => {
    const k = await key()
    const envelope = await encryptWithKey('hello', k)

    const bytes = Uint8Array.from(atob(envelope), (c) => c.charCodeAt(0))
    bytes[bytes.length - 1] ^= 0xff
    const tampered = btoa(String.fromCharCode(...bytes))

    await expect(decryptWithKey(tampered, k)).rejects.toThrow(DecryptionError)
  })

  it('rejects an unknown envelope version', async () => {
    const k = await key()
    const envelope = await encryptWithKey('hello', k)

    const bytes = Uint8Array.from(atob(envelope), (c) => c.charCodeAt(0))
    bytes[0] = 99
    const future = btoa(String.fromCharCode(...bytes))

    await expect(decryptWithKey(future, k)).rejects.toThrow(/Unsupported envelope version/)
  })

  // Proves the version byte is authenticated rather than merely present: the
  // same ciphertext won't open without it as associated data.
  it('binds the envelope version into the AEAD', async () => {
    const k = await key()
    const packed = Uint8Array.from(atob(await encryptWithKey('hello', k)), (c) => c.charCodeAt(0))
    const iv = packed.slice(1, 13)
    const ciphertext = packed.slice(13)

    await expect(crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, ciphertext)).rejects.toThrow()

    const withAad = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: new Uint8Array([1]) },
      k,
      ciphertext,
    )

    expect(new TextDecoder().decode(withAad)).toBe('hello')
  })

  it('rejects a truncated envelope', async () => {
    const k = await key()

    await expect(decryptWithKey(btoa('\x01short'), k)).rejects.toThrow(DecryptionError)
  })
})

describe('PBKDF2_ITERATIONS', () => {
  it('meets OWASP guidance', () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000)
  })
})
