import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'
import { decrypt, encrypt } from '../lib/keystore'

export interface Journal {
  id: number
  title: string
  createdAt: string
}

interface UseJournalsResult {
  /** null while the initial fetch is in flight, then always an array. */
  journals: Journal[] | null
  error: string | null
  create: (title: string) => Promise<void>
}

async function decryptJournal(record: api.JournalRecord): Promise<Journal> {
  return { id: record.id, title: await decrypt(record.title), createdAt: record.created_at }
}

export function useJournals(enabled: boolean): UseJournalsResult {
  const [journals, setJournals] = useState<Journal[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    api
      .listJournals()
      .then((records) => Promise.all(records.map(decryptJournal)))
      .then((decrypted) => {
        if (cancelled) return
        setJournals(decrypted)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Unable to load journals.')
      })

    return () => {
      cancelled = true
      // Runs the instant `enabled` flips (or the hook unmounts), before any
      // new fetch resolves — without this, a stale array from a previous
      // session would otherwise linger and briefly render as if it belonged
      // to whoever is signed in now.
      setJournals(null)
      setError(null)
    }
  }, [enabled])

  const create = useCallback(async (title: string) => {
    const record = await api.createJournal(await encrypt(title))
    setJournals((current) => [...(current ?? []), { id: record.id, title, createdAt: record.created_at }])
  }, [])

  return { journals, error, create }
}
