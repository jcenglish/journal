import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'
import { decryptEntry, encryptEntry, type Entry, type EntryDraft } from '../lib/entries'

interface UseEntryResult {
  /** Always null for a new entry; null while an existing one is loading. */
  entry: Entry | null
  loading: boolean
  error: string | null
  save: (draft: EntryDraft) => Promise<void>
}

/** Pass entryId null for a new entry. */
export function useEntry(journalId: number, entryId: number | null): UseEntryResult {
  const [entry, setEntry] = useState<Entry | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (entryId === null) return

    let cancelled = false

    api
      .getEntry(journalId, entryId)
      .then(decryptEntry)
      .then((decrypted) => {
        if (cancelled) return
        setEntry(decrypted)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Unable to load this entry.')
      })

    return () => {
      cancelled = true
      setEntry(null)
      setError(null)
    }
  }, [journalId, entryId])

  const save = useCallback(
    async (draft: EntryDraft) => {
      const fields = await encryptEntry(draft)
      if (entryId === null) {
        await api.createEntry(journalId, fields)
      } else {
        await api.updateEntry(journalId, entryId, fields)
      }
    },
    [journalId, entryId],
  )

  const loading = entryId !== null && entry === null && error === null

  return { entry, loading, error, save }
}
