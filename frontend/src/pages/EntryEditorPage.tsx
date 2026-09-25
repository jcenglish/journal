import { useId, useState, type FormEvent } from 'react'
import type { JSONContent } from '@tiptap/react'
import { ContentEditor } from '../components/ContentEditor'
import { RatingSelector } from '../components/RatingSelector'
import { useEntry } from '../hooks/useEntry'
import { emptyDoc, todayLocal, type Entry, type EntryDraft } from '../lib/entries'
import styles from './EntryEditorPage.module.css'

interface EntryEditorPageProps {
  journalId: number
  /** null creates a new entry; otherwise the entry is loaded and pre-filled. */
  entryId: number | null
  onBack: () => void
  onSaved: () => void
}

export function EntryEditorPage({ journalId, entryId, onBack, onSaved }: EntryEditorPageProps) {
  const { entry, loading, error, save } = useEntry(journalId, entryId)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Back">
          ‹
        </button>
        <h1 className={styles.title}>{entryId === null ? 'New Entry' : 'Edit Entry'}</h1>
      </header>

      {loading && <p className={styles.status}>Loading…</p>}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {(entryId === null || entry) && <EntryForm entry={entry} onSave={save} onSaved={onSaved} />}
    </main>
  )
}

interface EntryFormProps {
  entry: Entry | null
  onSave: (draft: EntryDraft) => Promise<void>
  onSaved: () => void
}

function EntryForm({ entry, onSave, onSaved }: EntryFormProps) {
  const ids = useId()
  const [entryDate, setEntryDate] = useState(entry?.entryDate ?? todayLocal())
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState<JSONContent>(entry?.content ?? emptyDoc())
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null)
  const [health, setHealth] = useState<number | null>(entry?.health ?? null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)

    try {
      await onSave({ entryDate, title, content, mood, health })
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
      setPending(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${ids}-date`}>
            Date
          </label>
          <input
            id={`${ids}-date`}
            className={styles.input}
            type="date"
            value={entryDate}
            required
            onChange={(event) => setEntryDate(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${ids}-title`}>
            Title (optional)
          </label>
          <input
            id={`${ids}-title`}
            className={styles.input}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label} id={`${ids}-content`}>
          Content
        </span>
        <ContentEditor initialContent={content} onChange={setContent} labelId={`${ids}-content`} />
      </div>

      <RatingSelector legend="Mood" name={`${ids}-mood`} value={mood} onChange={setMood} />
      <RatingSelector legend="Health" name={`${ids}-health`} value={health} onChange={setHealth} />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
