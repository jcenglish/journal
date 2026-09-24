import { useRef, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useJournals } from './hooks/useJournals'
import { AuthPage } from './pages/AuthPage'
import { CreateJournalPage } from './pages/CreateJournalPage'
import { HomePage } from './pages/HomePage'

type View = 'home' | 'createJournal'

function App() {
  const { user, logOut } = useAuth()
  const { journals, error, create } = useJournals(user !== null)
  const [view, setView] = useState<View>('home')

  // A session ending — an explicit logout or the reload policy in
  // AuthProvider — must not leave a stale "createJournal" view sitting
  // behind the auth screen for whoever logs in next. Adjusted during render,
  // React's documented way to reset state in response to an identity change,
  // rather than an effect that would fire a render after the fact.
  const lastUserId = useRef<number | null>(null)
  if (user?.id !== lastUserId.current) {
    lastUserId.current = user?.id ?? null
    if (view !== 'home') setView('home')
  }

  if (!user) return <AuthPage />

  if (view === 'createJournal') {
    return (
      <CreateJournalPage
        onBack={() => setView('home')}
        onCreate={async (title) => {
          await create(title)
          setView('home')
        }}
      />
    )
  }

  return (
    <HomePage
      journals={journals}
      error={error}
      onNewJournal={() => setView('createJournal')}
      onLogOut={() => void logOut()}
    />
  )
}

export default App
