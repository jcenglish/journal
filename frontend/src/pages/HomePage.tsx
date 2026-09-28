import type { Journal } from '../hooks/useJournals'
import styles from './HomePage.module.css'

interface HomePageProps {
  journals: Journal[] | null
  error: string | null
  onNewJournal: () => void
  onOpenJournal: (journalId: number) => void
  onLogOut: () => void
}

export function HomePage({ journals, error, onNewJournal, onOpenJournal, onLogOut }: HomePageProps) {
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
            <li key={journal.id}>
              <button type="button" className={styles.item} onClick={() => onOpenJournal(journal.id)}>
                <span className={styles.itemTitle}>{journal.title}</span>
              </button>
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
