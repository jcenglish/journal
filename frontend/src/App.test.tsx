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
  it('does not leave a stale Create Journal view behind once a different user is signed in', async () => {
    stubEmptyJournalsFetch()
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
  })
})
