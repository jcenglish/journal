import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../components/AuthProvider'
import { clearDataKey, hasDataKey } from '../lib/keystore'
import { AuthPage } from './AuthPage'

const PASSWORD = 'correct horse battery'
const EMAIL = 'one@example.com'

// Keeps the suite fast without weakening what's under test: the component calls
// deriveCredentials with the real constant, so only the cost is stubbed.
vi.mock('../lib/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/crypto')>()
  return {
    ...actual,
    deriveCredentials: (email: string, password: string) =>
      actual.deriveCredentials(email, password, { iterations: 1_000 }),
  }
})

function stubApi() {
  const fetchMock = vi.fn(async (path: string | URL | Request, init?: RequestInit) => {
    const url = String(path)

    if (url.endsWith('/api/session') && init?.method === 'DELETE') {
      return new Response(null, { status: 204 })
    }

    // Wrap a data key with the same credentials the component is deriving, so
    // login can actually unwrap it.
    const { deriveCredentials, generateWrappedDataKey } = await import('../lib/crypto')
    const { wrapKey } = await deriveCredentials(EMAIL, PASSWORD, { iterations: 1_000 })
    const { blob } = await generateWrappedDataKey(wrapKey)

    return new Response(
      JSON.stringify({ id: 1, email: EMAIL, encrypted_data_key: blob }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage() {
  return render(
    <AuthProvider>
      <AuthPage />
    </AuthProvider>,
  )
}

async function fillAndSubmit(name: RegExp) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), EMAIL)
  await user.type(screen.getByLabelText('Password'), PASSWORD)
  await user.click(screen.getByRole('button', { name }))
}

beforeEach(() => stubApi())

afterEach(() => {
  clearDataKey()
  vi.unstubAllGlobals()
})

describe('AuthPage', () => {
  it('defaults to logging in and switches to signing up', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('radio', { name: 'Log In' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Sign Up' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Log In' })).toHaveAttribute('type', 'submit')

    await user.click(screen.getByRole('radio', { name: 'Sign Up' }))

    expect(screen.getByRole('radio', { name: 'Sign Up' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Sign Up' })).toHaveAttribute('type', 'submit')
  })

  // Acceptance criterion: the password-loss warning is visible on the Auth screen.
  it('shows the password-loss warning', () => {
    renderPage()

    expect(
      screen.getByText("⚠ We can't reset a lost password — it's the key to your encrypted entries."),
    ).toBeInTheDocument()
  })

  it('labels the password field for a new password when signing up', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')

    await user.click(screen.getByRole('radio', { name: 'Sign Up' }))

    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
  })

  // The ticket's third test case: no request may carry the key or the password
  // that produces it.
  it('sends a derived auth hash, never the typed password', async () => {
    const fetchMock = stubApi()
    renderPage()

    await fillAndSubmit(/^Log In$/)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [path, init] = fetchMock.mock.calls.at(-1)!
    const body = JSON.parse(String(init?.body)) as { session: { password: string } }

    expect(String(path)).toBe('/api/session')
    expect(body.session.password).toHaveLength(44)
    expect(body.session.password).not.toBe(PASSWORD)
    expect(JSON.stringify(init)).not.toContain(PASSWORD)

    // Let the login finish before the test ends. Otherwise the unwrap resolves
    // after afterEach has cleared the key and plants one in the next test.
    await waitFor(() => expect(hasDataKey()).toBe(true))
  })

  it('posts to the signup endpoint with a wrapped data key when signing up', async () => {
    const fetchMock = stubApi()
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('radio', { name: 'Sign Up' }))
    await fillAndSubmit(/^Sign Up$/)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [path, init] = fetchMock.mock.calls.at(-1)!
    const body = JSON.parse(String(init?.body)) as {
      user: { password: string; encrypted_data_key: string }
    }

    expect(String(path)).toBe('/api/signup')
    expect(body.user.encrypted_data_key).toBeTruthy()
    expect(JSON.stringify(init)).not.toContain(PASSWORD)

    await waitFor(() => expect(hasDataKey()).toBe(true))
  })

  it('never writes anything to browser storage on a successful login', async () => {
    renderPage()

    await fillAndSubmit(/^Log In$/)

    await waitFor(() => expect(hasDataKey()).toBe(true))
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('rejects a short password at signup without calling the API', async () => {
    const fetchMock = stubApi()
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('radio', { name: 'Sign Up' }))
    await user.type(screen.getByLabelText('Email'), EMAIL)
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: /^Sign Up$/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 10 characters/)
    // The provider's mount effect fires a DELETE (the reload policy), so assert
    // specifically that no account was created rather than that nothing was sent.
    expect(fetchMock.mock.calls.map(([path]) => String(path))).not.toContain('/api/signup')
    expect(hasDataKey()).toBe(false)
  })

  it('surfaces a rejected login and holds no key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 }),
      ),
    )
    renderPage()

    await fillAndSubmit(/^Log In$/)

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(hasDataKey()).toBe(false)
  })
})
