import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { decryptEntrySummary, type EntrySummary } from '../lib/entries'

interface UseEntriesResult {
  /** null while the first page is in flight, then always an array. */
  entries: EntrySummary[] | null
  error: string | null
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => void
}

async function fetchPage(journalId: number, page: number) {
  const record = await api.listEntries(journalId, page)
  return { entries: await Promise.all(record.entries.map(decryptEntrySummary)), nextPage: record.next_page }
}

function messageFrom(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'Unable to load entries.'
}

export function useEntries(journalId: number): UseEntriesResult {
  const [entries, setEntries] = useState<EntrySummary[] | null>(null)
  const [nextPage, setNextPage] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  // One token per journal, cancelled when it changes, so a "load more" still in
  // flight for the previous journal can't append its rows to this one.
  const activeLoad = useRef({ cancelled: false })

  useEffect(() => {
    const load = { cancelled: false }
    activeLoad.current = load

    fetchPage(journalId, 1)
      .then((page) => {
        if (load.cancelled) return
        setEntries(page.entries)
        setNextPage(page.nextPage)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (load.cancelled) return
        setError(messageFrom(caught))
      })

    return () => {
      load.cancelled = true
      setEntries(null)
      setNextPage(null)
      setError(null)
      setLoadingMore(false)
    }
  }, [journalId])

  const loadMore = useCallback(() => {
    if (nextPage === null || loadingMore) return

    const load = activeLoad.current
    setLoadingMore(true)

    fetchPage(journalId, nextPage)
      .then((page) => {
        if (load.cancelled) return
        setEntries((existing) => [...(existing ?? []), ...page.entries])
        setNextPage(page.nextPage)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (load.cancelled) return
        setError(messageFrom(caught))
      })
      .finally(() => {
        if (!load.cancelled) setLoadingMore(false)
      })
  }, [journalId, nextPage, loadingMore])

  return { entries, error, hasMore: nextPage !== null, loadingMore, loadMore }
}
