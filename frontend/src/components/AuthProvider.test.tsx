import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../hooks/useAuth'
import { VaultLockedError, clearDataKey, decrypt, encrypt, hasDataKey } from '../lib/keystore'
import { AuthProvider } from './AuthProvider'

const PASSWORD = 'correct horse battery'
const EMAIL = 'one@example.com'

vi.mock('../lib/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/crypto')>()
  return {
    ...actual,
    deriveCredentials: (email: string, password: string) =>
      actual.deriveCredentials(email, password, { iterations: 1_000 }),
  }
})

function stubApi({ logOutFails = false } = {}) {
  const fetchMock = vi.fn(async (_path: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      if (logOutFails) throw new TypeError('Network request failed')
      return new Response(null, { status: 204 })
    }

    const { deriveCredentials, generateWrappedDataKey } = await import('../lib/crypto')
    const { wrapKey } = await deriveCredentials(EMAIL, PASSWORD, { iterations: 1_000 })
    const { blob } = await generateWrappedDataKey(wrapKey)

    return new Response(JSON.stringify({ id: 1, email: EMAIL, encrypted_data_key: blob }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function Harness() {
  const { user, logIn, logOut } = useAuth()

  return (
    <div>
      <p>{user ? `Signed in as ${user.email}` : 'Signed out'}</p>
      {/* AuthPage catches and renders this; the harness only needs it not to
          surface as an unhandled rejection. */}
      <button type="button" onClick={() => void logIn(EMAIL, PASSWORD).catch(() => {})}>
        Log in
      </button>
      <button type="button" onClick={() => void logOut()}>
        Log out
      </button>
    </div>
  )
}

const renderHarness = () =>
  render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  )

async function logIn() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Log in' }))
  await screen.findByText(`Signed in as ${EMAIL}`)
}

beforeEach(() => stubApi())

afterEach(() => {
  clearDataKey()
  vi.unstubAllGlobals()
})

describe('AuthProvider', () => {
  it('holds a usable key after logging in', async () => {
    renderHarness()
    await logIn()

    expect(hasDataKey()).toBe(true)
    expect(await decrypt(await encrypt('a private thought'))).toBe('a private thought')
  })

  // The ticket's fourth test case, end to end: after logout the key is gone from
  // memory and decryption fails until the user logs in again.
  it('clears the key on logout, so decryption fails without re-login', async () => {
    renderHarness()
    await logIn()

    const envelope = await encrypt('a private thought')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))

    await screen.findByText('Signed out')
    expect(hasDataKey()).toBe(false)
    await expect(decrypt(envelope)).rejects.toThrow(VaultLockedError)
  })

  it('still clears the key when the logout request fails', async () => {
    renderHarness()
    await logIn()

    stubApi({ logOutFails: true })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(hasDataKey()).toBe(false))
  })

  // A reload keeps the session cookie but loses the key, so the provider ends
  // the session rather than leaving a half-authenticated state behind.
  it('ends a stale session on mount when no key is in memory', async () => {
    const fetchMock = stubApi()
    renderHarness()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/session', expect.objectContaining({ method: 'DELETE' }))
    })
    expect(screen.getByText('Signed out')).toBeInTheDocument()
  })

  // The salt is the normalized email, so the stored email has to be normalized
  // the same way. Ruby's String#strip leaves the NBSP that JS trim() removes, so
  // sending the raw value would store an address the client can't reproduce —
  // a permanent lockout, with no password reset to recover through.
  it('sends the same normalized email it salted with', async () => {
    const fetchMock = stubApi()

    function PaddedLogin() {
      const { logIn } = useAuth()
      return (
        <button type="button" onClick={() => void logIn(`  ${EMAIL}\u00A0`, PASSWORD).catch(() => {})}>
          Log in padded
        </button>
      )
    }

    render(
      <AuthProvider>
        <PaddedLogin />
      </AuthProvider>,
    )

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log in padded' }))

    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
      expect(posted).toBeDefined()
      expect(JSON.parse(String(posted![1]?.body)).session.email).toBe(EMAIL)
    })

    // Settle the login inside this test, so its unwrap can't set a key after
    // afterEach has cleared it.
    await waitFor(() => expect(hasDataKey()).toBe(true))
  })

  it('holds no key when login is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid' }), { status: 401 })),
    )
    renderHarness()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(screen.getByText('Signed out')).toBeInTheDocument())
    expect(hasDataKey()).toBe(false)
  })
})
