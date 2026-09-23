import type { Journal } from '../hooks/useJournals'
import styles from './HomePage.module.css'

interface HomePageProps {
  journals: Journal[] | null
  error: string | null
  onNewJournal: () => void
  onLogOut: () => void
}

export function HomePage({ journals, error, onNewJournal, onLogOut }: HomePageProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Journals</h1>
        <button type="button" className={styles.logOut} onClick={onLogOut}>
          Log out
        </button>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {journals && journals.length === 0 && (
        <p className={styles.empty}>No journals yet — tap + to create your first one.</p>
      )}

      {journals && journals.length > 0 && (
        <ul className={styles.list}>
          {journals.map((journal) => (
            <li key={journal.id} className={styles.item}>
              <span className={styles.itemTitle}>{journal.title}</span>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={styles.addButton} onClick={onNewJournal} aria-label="New journal">
        +
      </button>
    </main>
  )
}
