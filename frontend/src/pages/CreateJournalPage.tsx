import { useState, type FormEvent } from 'react'
import styles from './CreateJournalPage.module.css'

interface CreateJournalPageProps {
  onCreate: (title: string) => Promise<void>
  onBack: () => void
}

export function CreateJournalPage({ onCreate, onBack }: CreateJournalPageProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    // There's no server-side blank check — the server only ever sees
    // ciphertext, so this has to be caught before encryption/sending.
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Please enter a title.')
      return
    }

    setError(null)
    setPending(true)
    try {
      await onCreate(trimmed)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
      setPending(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Back">
          ‹
        </button>
        <h1 className={styles.title}>New Journal</h1>
      </header>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="journal-title">
            Title
          </label>
          <input
            id="journal-title"
            className={styles.input}
            type="text"
            value={title}
            required
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </main>
  )
}
