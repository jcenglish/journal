import { useLayoutEffect, useRef } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'
import { useAuth } from './hooks/useAuth'
import { useJournals } from './hooks/useJournals'
import { AuthPage } from './pages/AuthPage'
import { CreateJournalPage } from './pages/CreateJournalPage'
import { HomePage } from './pages/HomePage'

// Distinguishes "no identity observed yet" (initial mount — a deep link
// while already logged in must not bounce to home) from "previously logged
// out" (id `null`), which is a real identity change worth resetting for.
const UNSET = Symbol('unset')

function App() {
  const { user, logOut } = useAuth()
  const { journals, error, create } = useJournals(user !== null)
  const [, navigate] = useLocation()

  // A session ending — an explicit logout or the reload policy in
  // AuthProvider — must not leave a stale route sitting behind the auth
  // screen for whoever logs in next. Navigating is a side effect on
  // browser history, so it can't happen during render; a layout effect
  // (rather than a plain effect) runs before the browser paints, so it
  // still avoids a visible flash of the stale route — the same technique
  // wouter's own <Redirect> uses internally.
  const lastUserId = useRef<number | null | typeof UNSET>(UNSET)
  useLayoutEffect(() => {
    if (user?.id !== lastUserId.current) {
      const identityChanged = lastUserId.current !== UNSET
      lastUserId.current = user?.id ?? null
      if (identityChanged) navigate('/', { replace: true })
    }
  })

  if (!user) return <AuthPage />

  return (
    <Switch>
      <Route path="/">
        <HomePage
          journals={journals}
          error={error}
          onNewJournal={() => navigate('/journals/new')}
          onLogOut={() => void logOut()}
        />
      </Route>
      <Route path="/journals/new">
        <CreateJournalPage
          onBack={() => navigate('/', { replace: true })}
          onCreate={async (title) => {
            await create(title)
            navigate('/', { replace: true })
          }}
        />
      </Route>
      {/* Route shape reserved for the Entry CRUD slice; not implemented yet. */}
      <Route path="/journals/:journalId/entries/:entryId">
        <Redirect to="/" replace />
      </Route>
      <Route path="/journals/:journalId">
        <Redirect to="/" replace />
      </Route>
      <Route>
        <Redirect to="/" replace />
      </Route>
    </Switch>
  )
}

export default App
