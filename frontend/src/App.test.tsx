import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthContext, type AuthContextValue } from './lib/authContext'
import { deriveCredentials, encryptWithKey, generateWrappedDataKey } from './lib/crypto'
import { clearDataKey, setDataKey } from './lib/keystore'

function stubEmptyJournalsFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
}

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return { user: null, logIn: vi.fn(), signUp: vi.fn(), logOut: vi.fn(), ...overrides }
}

async function stubJournalWithNoEntries() {
  const { wrapKey } = await deriveCredentials('one@example.com', 'correct horse battery', { iterations: 1_000 })
  const { dataKey } = await generateWrappedDataKey(wrapKey)
  setDataKey(dataKey)
  const journals = [{ id: 3, title: await encryptWithKey('Morning Pages', dataKey), created_at: '2026-01-01T00:00:00.000Z' }]

  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      const body = path === '/api/journals' ? journals : { entries: [], next_page: null }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
}

afterEach(() => {
  clearDataKey()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('navigates from Home to Create Journal and back with the browser back button', async () => {
    stubEmptyJournalsFetch()
    window.history.pushState({}, '', '/')
    const user = userEvent.setup()

    render(
      <AuthContext.Provider value={authValue({ user: { id: 1, email: 'one@example.com' } })}>
        <App />
      </AuthContext.Provider>,
    )

    await user.click(await screen.findByRole('button', { name: 'New journal' }))
    expect(screen.getByRole('heading', { name: 'New Journal' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/journals/new')

    window.history.back()

    expect(await screen.findByRole('heading', { name: 'Journals' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('does not leave a stale Create Journal route behind once a different user is signed in', async () => {
    stubEmptyJournalsFetch()
    window.history.pushState({}, '', '/')
    const user = userEvent.setup()

    const { rerender } = render(
      <AuthContext.Provider value={authValue({ user: { id: 1, email: 'one@example.com' } })}>
        <App />
      </AuthContext.Provider>,
    )

    await user.click(await screen.findByRole('button', { name: 'New journal' }))
    expect(screen.getByRole('heading', { name: 'New Journal' })).toBeInTheDocument()

    // The session ends without a logout click on this screen — e.g. it expired
    // server-side — so App falls back to the Auth page.
    rerender(
      <AuthContext.Provider value={authValue({ user: null })}>
        <App />
      </AuthContext.Provider>,
    )
    expect(screen.getByRole('heading', { name: 'Journal' })).toBeInTheDocument()

    // A different user logs back in on the same tab.
    rerender(
      <AuthContext.Provider value={authValue({ user: { id: 2, email: 'two@example.com' } })}>
        <App />
      </AuthContext.Provider>,
    )

    expect(await screen.findByRole('heading', { name: 'Journals' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'New Journal' })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it("redirects a deep link to a journal the user doesn't have to home", async () => {
    stubEmptyJournalsFetch()
    window.history.pushState({}, '', '/journals/3')

    render(
      <AuthContext.Provider value={authValue({ user: { id: 1, email: 'one@example.com' } })}>
        <App />
      </AuthContext.Provider>,
    )

    expect(await screen.findByRole('heading', { name: 'Journals' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('navigates Home → Journal → New Entry, and back to the journal', async () => {
    await stubJournalWithNoEntries()
    window.history.pushState({}, '', '/')
    const user = userEvent.setup()

    render(
      <AuthContext.Provider value={authValue({ user: { id: 1, email: 'one@example.com' } })}>
        <App />
      </AuthContext.Provider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Morning Pages' }))
    expect(await screen.findByRole('heading', { name: 'Morning Pages' })).toBeInTheDocument()
    expect(await screen.findByText('No entries yet.')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/journals/3')

    await user.click(screen.getByRole('button', { name: 'New entry' }))
    expect(screen.getByRole('heading', { name: 'New Entry' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/journals/3/entries/new')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { name: 'Morning Pages' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/journals/3')

    // In-app Back popped the editor rather than stacking a second journal
    // entry, so the browser's own back button now lands on Home.
    window.history.back()
    expect(await screen.findByRole('heading', { name: 'Journals' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('replaces a deep-linked editor with its journal on Back, since there is no parent to pop to', async () => {
    await stubJournalWithNoEntries()
    window.history.replaceState(null, '', '/journals/3/entries/new')
    const user = userEvent.setup()

    render(
      <AuthContext.Provider value={authValue({ user: { id: 1, email: 'one@example.com' } })}>
        <App />
      </AuthContext.Provider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Back' }))

    expect(await screen.findByRole('heading', { name: 'Morning Pages' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/journals/3')
  })

  it.each(['1.5', '1e3', '0x10', 'abc'])('redirects a malformed entry id (%s) to home', async (entryId) => {
    await stubJournalWithNoEntries()
    window.history.pushState({}, '', `/journals/3/entries/${entryId}`)

    render(
      <AuthContext.Provider value={authValue({ user: { id: 1, email: 'one@example.com' } })}>
        <App />
      </AuthContext.Provider>,
    )

    expect(await screen.findByRole('heading', { name: 'Journals' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('does not redirect a deep link to a new entry once journals have loaded', async () => {
    await stubJournalWithNoEntries()
    window.history.pushState({}, '', '/journals/3/entries/new')

    render(
      <AuthContext.Provider value={authValue({ user: { id: 1, email: 'one@example.com' } })}>
        <App />
      </AuthContext.Provider>,
    )

    expect(await screen.findByRole('heading', { name: 'New Entry' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/journals/3/entries/new')
  })

  it('does not redirect a deep link to an implemented route on initial load', async () => {
    stubEmptyJournalsFetch()
    window.history.pushState({}, '', '/journals/new')

    render(
      <AuthContext.Provider value={authValue({ user: { id: 1, email: 'one@example.com' } })}>
        <App />
      </AuthContext.Provider>,
    )

    expect(await screen.findByRole('heading', { name: 'New Journal' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/journals/new')
  })
})
