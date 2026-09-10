import { AuthPage } from './pages/AuthPage'
import { useAuth } from './hooks/useAuth'

function App() {
  const { user, logOut } = useAuth()

  if (!user) return <AuthPage />

  // Placeholder until slice 3 brings the Journals list and a router.
  return (
    <main>
      <p>Signed in as {user.email}</p>
      <button type="button" onClick={() => void logOut()}>
        Log out
      </button>
    </main>
  )
}

export default App
