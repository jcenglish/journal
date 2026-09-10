import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import styles from './AuthPage.module.css'

type Mode = 'logIn' | 'signUp'

// Enforced here because it structurally cannot be enforced server-side: the
// backend only ever sees a fixed-length derived hash, never the password.
const MINIMUM_PASSWORD_LENGTH = 10

export function AuthPage() {
  const { logIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('logIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function switchTo(next: Mode) {
    setMode(next)
    setError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (mode === 'signUp' && password.length < MINIMUM_PASSWORD_LENGTH) {
      setError(`Please use at least ${MINIMUM_PASSWORD_LENGTH} characters — there's no way to reset it.`)
      return
    }

    setPending(true)
    try {
      await (mode === 'logIn' ? logIn(email, password) : signUp(email, password))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Journal</h1>
        <p className={styles.subtitle}>a private journal</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {/* A segmented control is a mutually exclusive choice, so it's a radio
            group: real inputs give arrow-key navigation for free, and keep the
            mode toggle from sharing an accessible name with the submit button. */}
        <fieldset className={styles.modes}>
          <legend className={styles.legend}>Log in or sign up</legend>
          {(['logIn', 'signUp'] as const).map((value) => (
            <label key={value} className={styles.mode}>
              <input
                className={styles.modeInput}
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => switchTo(value)}
              />
              <span className={styles.modeText}>{value === 'logIn' ? 'Log In' : 'Sign Up'}</span>
            </label>
          ))}
        </fieldset>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className={styles.input}
            type="email"
            value={email}
            autoComplete="email"
            required
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className={styles.input}
            type="password"
            value={password}
            autoComplete={mode === 'logIn' ? 'current-password' : 'new-password'}
            required
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {/* Deriving the key is ~600k PBKDF2 iterations — seconds on a low-end
            phone — so the button has to say something while it runs. */}
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? 'Deriving your key…' : mode === 'logIn' ? 'Log In' : 'Sign Up'}
        </button>
      </form>

      <p className={styles.warning}>
        ⚠ We can't reset a lost password — it's the key to your encrypted entries.
      </p>
    </main>
  )
}
