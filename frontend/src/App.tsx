import { useLayoutEffect, useRef } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'
import { useAuth } from './hooks/useAuth'
import { useJournals } from './hooks/useJournals'
import { AuthPage } from './pages/AuthPage'
import { CreateJournalPage } from './pages/CreateJournalPage'
import { EntryEditorPage } from './pages/EntryEditorPage'
import { HomePage } from './pages/HomePage'
import { JournalPage } from './pages/JournalPage'

// Distinguishes "no identity observed yet" (initial mount — a deep link
// while already logged in must not bounce to home) from "previously logged
// out" (id `null`), which is a real identity change worth resetting for.
const UNSET = Symbol('unset')

const CHILD_ENTRY = { openedFromParent: true }

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

  // A screen opened from its parent marks its history entry, so going "up"
  // from it pops back to the parent instead of stacking another copy. A deep
  // link has no such mark, so it replaces itself with the parent instead.
  const openChild = (to: string) => navigate(to, { state: CHILD_ENTRY })
  const goUp = (parent: string) => {
    if ((window.history.state as typeof CHILD_ENTRY | null)?.openedFromParent) window.history.back()
    else navigate(parent, { replace: true })
  }

  // undefined while journals are still loading (or failed — Home shows why);
  // null once loaded if the id isn't one of this user's journals.
  function findJournal(journalId: string) {
    if (journals === null) return error ? null : undefined
    return journals.find((journal) => journal.id === Number(journalId)) ?? null
  }

  return (
    <Switch>
      <Route path="/">
        <HomePage
          journals={journals}
          error={error}
          onNewJournal={() => openChild('/journals/new')}
          onOpenJournal={(journalId) => openChild(`/journals/${journalId}`)}
          onLogOut={() => void logOut()}
        />
      </Route>
      <Route path="/journals/new">
        <CreateJournalPage
          onBack={() => goUp('/')}
          onCreate={async (title) => {
            await create(title)
            goUp('/')
          }}
        />
      </Route>
      <Route path="/journals/:journalId/entries/:entryId">
        {({ journalId, entryId }) => {
          const journal = findJournal(journalId)
          if (journal === undefined) return null
          const id = entryId === 'new' ? null : /^\d+$/.test(entryId) ? Number(entryId) : Number.NaN
          if (!journal || Number.isNaN(id)) return <Redirect to="/" replace />
          const journalPath = `/journals/${journal.id}`
          return (
            <EntryEditorPage
              key={`${journal.id}/${entryId}`}
              journalId={journal.id}
              entryId={id}
              onBack={() => goUp(journalPath)}
              onSaved={() => goUp(journalPath)}
            />
          )
        }}
      </Route>
      <Route path="/journals/:journalId">
        {({ journalId }) => {
          const journal = findJournal(journalId)
          if (journal === undefined) return null
          if (!journal) return <Redirect to="/" replace />
          return (
            <JournalPage
              key={journal.id}
              journal={journal}
              onBack={() => goUp('/')}
              onNewEntry={() => openChild(`/journals/${journal.id}/entries/new`)}
              onOpenEntry={(entryId) => openChild(`/journals/${journal.id}/entries/${entryId}`)}
            />
          )
        }}
      </Route>
      <Route>
        <Redirect to="/" replace />
      </Route>
    </Switch>
  )
}

export default App
