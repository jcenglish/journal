import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { JSONContent } from '@tiptap/react'
import { ContentEditor } from '../components/ContentEditor'
import { RatingSelector } from '../components/RatingSelector'
import { TagPicker } from '../components/TagPicker'
import { useAutosave, type AutosaveStatus } from '../hooks/useAutosave'
import { useEntry } from '../hooks/useEntry'
import { useTags } from '../hooks/useTags'
import { draftKey, loadDraft, type StoredDraft } from '../lib/drafts'
import { emptyDoc, todayLocal, type Entry, type EntryDraft } from '../lib/entries'
import styles from './EntryEditorPage.module.css'

interface EntryEditorPageProps {
  userId: number
  journalId: number
  /** null creates a new entry; otherwise the entry is loaded and pre-filled. */
  entryId: number | null
  onBack: () => void
  onSaved: () => void
}

const STATUS_LABELS: Record<AutosaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Couldn’t save — your changes are kept on this device. We’ll try again as you keep editing.',
}

export function EntryEditorPage({ userId, journalId, entryId, onBack, onSaved }: EntryEditorPageProps) {
  const key = draftKey(userId, journalId, entryId)
  const [restored] = useState(() => loadDraft(key))
  const { entry, loading, error, save } = useEntry(journalId, entryId, restored?.serverId)

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

      {(entryId === null || entry) && (
        <EntryForm entry={entry} restored={restored} draftKey={key} onSave={save} onSaved={onSaved} />
      )}
    </main>
  )
}

interface EntryFormProps {
  entry: Entry | null
  restored: StoredDraft | null
  draftKey: string
  onSave: (draft: EntryDraft) => Promise<number>
  onSaved: () => void
}

function initialDraft(entry: Entry | null, restored: StoredDraft | null): EntryDraft {
  if (restored) return restored.draft
  return {
    entryDate: entry?.entryDate ?? todayLocal(),
    title: entry?.title ?? '',
    content: entry?.content ?? emptyDoc(),
    mood: entry?.mood ?? null,
    health: entry?.health ?? null,
    tagIds: entry?.tagIds ?? [],
  }
}

function EntryForm({ entry, restored, draftKey, onSave, onSaved }: EntryFormProps) {
  const ids = useId()
  const [draft, setDraft] = useState(() => initialDraft(entry, restored))
  const draftRef = useRef(draft)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const { tags, create: createTag } = useTags()
  const autosave = useAutosave({
    draftKey,
    save: onSave,
    initialServerId: restored?.serverId ?? null,
  })
  const { change, flush } = autosave

  const update = useCallback(
    (patch: Partial<EntryDraft>) => {
      draftRef.current = { ...draftRef.current, ...patch }
      setDraft(draftRef.current)
      change(draftRef.current)
    },
    [change],
  )
  const updateContent = useCallback((content: JSONContent) => update({ content }), [update])

  // A restored draft is unsaved by definition, so it goes through the same path as a fresh edit.
  useEffect(() => {
    if (restored) change(restored.draft)
  }, [restored, change])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)

    try {
      change(draftRef.current)
      await flush()
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
            value={draft.entryDate}
            required
            onChange={(event) => update({ entryDate: event.target.value })}
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
            value={draft.title}
            onChange={(event) => update({ title: event.target.value })}
          />
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label} id={`${ids}-content`}>
          Content
        </span>
        <ContentEditor initialContent={draft.content} onChange={updateContent} labelId={`${ids}-content`} />
      </div>

      <RatingSelector legend="Mood" name={`${ids}-mood`} value={draft.mood} onChange={(mood) => update({ mood })} />
      <RatingSelector legend="Health" name={`${ids}-health`} value={draft.health} onChange={(health) => update({ health })} />

      <TagPicker
        tags={tags}
        selectedIds={draft.tagIds}
        onChange={(tagIds) => update({ tagIds })}
        onCreateTag={createTag}
        labelId={`${ids}-tags`}
      />

      {restored && <p className={styles.status}>Restored your unsaved changes.</p>}
      <p className={styles.status} role="status">
        {STATUS_LABELS[autosave.status]}
      </p>

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
