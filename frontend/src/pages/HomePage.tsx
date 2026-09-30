import { useState } from 'react'
import { DeleteConfirmModal } from '../components/DeleteConfirmModal'
import { TrashButton } from '../components/TrashButton'
import type { Journal } from '../hooks/useJournals'
import styles from './HomePage.module.css'

interface HomePageProps {
  journals: Journal[] | null
  error: string | null
  onNewJournal: () => void
  onOpenJournal: (journalId: number) => void
  onDeleteJournal: (journalId: number) => Promise<void>
  onLogOut: () => void
}

export function HomePage({ journals, error, onNewJournal, onOpenJournal, onDeleteJournal, onLogOut }: HomePageProps) {
  const [deleting, setDeleting] = useState<Journal | null>(null)

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
            <li key={journal.id} className={styles.row}>
              <button type="button" className={styles.item} onClick={() => onOpenJournal(journal.id)}>
                <span className={styles.itemTitle}>{journal.title}</span>
              </button>
              <TrashButton label={`Delete ${journal.title}`} onClick={() => setDeleting(journal)} />
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <DeleteConfirmModal
          heading={`Delete "${deleting.title}"?`}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await onDeleteJournal(deleting.id)
            setDeleting(null)
          }}
        />
      )}

      <button type="button" className={styles.addButton} onClick={onNewJournal} aria-label="New journal">
        +
      </button>
    </main>
  )
}
