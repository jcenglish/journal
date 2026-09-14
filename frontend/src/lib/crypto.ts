/**
 * Client-side crypto for a zero-knowledge journal.
 *
 * The password does two jobs, and this module keeps them apart. One PBKDF2 pass
 * turns it into a master key; HKDF then splits that into a wrapping key that
 * never leaves the browser and an auth hash that is the only thing the server
 * ever sees. Because HKDF is one-way, holding the auth hash tells you nothing
 * about the wrapping key.
 *
 * The wrapping key doesn't encrypt user data directly — it wraps a random data
 * key, stored server-side as an opaque blob. That indirection is what makes a
 * future password change, email change, or iteration bump a re-wrap of one
 * value instead of re-encrypting every row. See design-decisions.md.
 */

export const KDF_VERSION = 1

/** OWASP's current PBKDF2-HMAC-SHA256 guidance. ~0.5-1s on a laptop. */
export const PBKDF2_ITERATIONS = 600_000

/** Prefixed to every envelope so the format can change without ambiguity. */
const ENVELOPE_VERSION = 1

const IV_BYTES = 12 // 96 bits, the size AES-GCM is specified around.
const KEY_BYTES = 32

const SALT_PREFIX = `journal:v${KDF_VERSION}:`
const WRAP_INFO = `journal:wrap:v${KDF_VERSION}`
const AUTH_INFO = `journal:auth:v${KDF_VERSION}`

export interface DerivedCredentials {
  /** Wraps the data key. Non-extractable, memory only, never transmitted. */
  wrapKey: CryptoKey
  /** Base64, 44 chars. Sent as the `password` param; the server bcrypts it. */
  authHash: string
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecryptionError'
  }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * Must stay byte-identical to `User.normalizes` in the Rails model. If the two
 * ever diverge, someone who signs up as "Foo@Example.com" and logs in as
 * "foo@example.com" authenticates fine but derives a different key — silent,
 * unrecoverable data loss in an app with no password reset.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function deriveCredentials(
  email: string,
  password: string,
  options: { iterations?: number } = {},
): Promise<DerivedCredentials> {
  const iterations = options.iterations ?? PBKDF2_ITERATIONS

  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  // The salt only needs to be unique, not secret or unpredictable, and the email
  // already is. Prefixing scopes it to this app so no precomputation against it
  // is reusable elsewhere. Using the email avoids a pre-login salt lookup, which
  // would be an account-enumeration oracle.
  const masterKeyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT_PREFIX + normalizeEmail(email)),
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    KEY_BYTES * 8,
  )

  const masterKey = await crypto.subtle.importKey('raw', masterKeyBits, 'HKDF', false, [
    'deriveKey',
    'deriveBits',
  ])

  const hkdf = (info: string) => ({
    name: 'HKDF' as const,
    hash: 'SHA-256' as const,
    salt: new Uint8Array(0),
    info: encoder.encode(info),
  })

  const wrapKey = await crypto.subtle.deriveKey(
    hkdf(WRAP_INFO),
    masterKey,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: even same-page XSS can't export it.
    ['encrypt', 'decrypt'],
  )

  const authBits = await crypto.subtle.deriveBits(hkdf(AUTH_INFO), masterKey, KEY_BYTES * 8)

  return { wrapKey, authHash: toBase64(new Uint8Array(authBits)) }
}

export async function encryptWithKey(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: versionAad(ENVELOPE_VERSION) },
    key,
    encoder.encode(plaintext),
  )

  return toBase64(packEnvelope(iv, new Uint8Array(ciphertext)))
}

export async function decryptWithKey(envelope: string, key: CryptoKey): Promise<string> {
  return decoder.decode(await decryptBytes(envelope, key))
}

// The version byte travels outside the ciphertext, so authenticate it as
// associated data. Without this it isn't covered by the GCM tag, and once a v2
// envelope exists a tampering server could silently downgrade v2 blobs to v1.
// Free to add now, while there is exactly one version; breaking to add later.
// Backed by an explicit ArrayBuffer: `new Uint8Array([n])` widens to
// ArrayBufferLike, which SubtleCrypto's BufferSource won't accept.
function versionAad(version: number): Uint8Array<ArrayBuffer> {
  const aad = new Uint8Array(new ArrayBuffer(1))
  aad[0] = version
  return aad
}

function packEnvelope(iv: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  const packed = new Uint8Array(1 + iv.length + ciphertext.length)
  packed[0] = ENVELOPE_VERSION
  packed.set(iv, 1)
  packed.set(ciphertext, 1 + iv.length)
  return packed
}

async function decryptBytes(envelope: string, key: CryptoKey): Promise<ArrayBuffer> {
  let packed: Uint8Array
  try {
    packed = fromBase64(envelope)
  } catch {
    throw new DecryptionError('Malformed envelope')
  }

  if (packed.length <= 1 + IV_BYTES) throw new DecryptionError('Malformed envelope')
  if (packed[0] !== ENVELOPE_VERSION) throw new DecryptionError(`Unsupported envelope version ${packed[0]}`)

  try {
    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: packed.slice(1, 1 + IV_BYTES), additionalData: versionAad(packed[0]) },
      key,
      packed.slice(1 + IV_BYTES),
    )
  } catch {
    // GCM authentication failed: wrong key, or the ciphertext was tampered with.
    throw new DecryptionError('Unable to decrypt')
  }
}

async function importDataKey(bytes: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', bytes as BufferSource, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
}

/**
 * Called once, at signup. Generates the data key as raw bytes rather than a
 * CryptoKey so it can be wrapped without ever existing as an extractable key.
 */
export async function generateWrappedDataKey(
  wrapKey: CryptoKey,
): Promise<{ dataKey: CryptoKey; blob: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(KEY_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const wrapped = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: versionAad(ENVELOPE_VERSION) },
    wrapKey,
    raw,
  )

  const dataKey = await importDataKey(raw)
  raw.fill(0)

  return { dataKey, blob: toBase64(packEnvelope(iv, new Uint8Array(wrapped))) }
}

export async function unwrapDataKey(blob: string, wrapKey: CryptoKey): Promise<CryptoKey> {
  return importDataKey(await decryptBytes(blob, wrapKey))
}
