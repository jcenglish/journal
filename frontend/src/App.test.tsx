import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthContext, type AuthContextValue } from './lib/authContext'

function stubEmptyJournalsFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
}

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return { user: null, logIn: vi.fn(), signUp: vi.fn(), logOut: vi.fn(), ...overrides }
}

afterEach(() => vi.unstubAllGlobals())

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

  it('redirects an unimplemented deep route (journal detail) to home instead of throwing', async () => {
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
