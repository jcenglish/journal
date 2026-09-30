import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'
import { decryptTag, encryptTagContent, type Tag } from '../lib/tags'

interface UseTagsResult {
  /** null while the initial fetch is in flight, then always an array. */
  tags: Tag[] | null
  error: string | null
  create: (content: string, color: string) => Promise<Tag>
}

/**
 * Fetches the current user's (small, per-user) tag list and decrypts it
 * client-side — see CLAUDE.md's Security & encryption. There is no server-side
 * search/filter by tag name; the whole list is small enough to hold in memory.
 */
export function useTags(): UseTagsResult {
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    api
      .listTags()
      .then((records) => Promise.all(records.map(decryptTag)))
      .then((decrypted) => {
        if (cancelled) return
        setTags(decrypted)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Unable to load tags.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const create = useCallback(async (content: string, color: string) => {
    const encrypted = await encryptTagContent(content)
    const record = await api.createTag(encrypted, color)
    const tag: Tag = { id: record.id, content: content.trim(), color: record.color }
    setTags((current) => [...(current ?? []), tag])
    return tag
  }, [])

  return { tags, error, create }
}
