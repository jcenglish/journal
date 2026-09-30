import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { decryptTag, encryptTagContent, type Tag } from '../lib/tags'

interface UseTagsResult {
  /** null while the initial fetch is in flight, then always an array. */
  tags: Tag[] | null
  error: string | null
  /** Returns the existing tag, unchanged, when the name matches one (trimmed, case-insensitive). */
  create: (content: string, color: string) => Promise<Tag>
}

const normalize = (name: string) => name.trim().toLocaleLowerCase()

/**
 * Fetches the current user's (small, per-user) tag list and decrypts it
 * client-side — see CLAUDE.md's Security & encryption. There is no server-side
 * search/filter by tag name; the whole list is small enough to hold in memory.
 */
export function useTags(): UseTagsResult {
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const knownTags = useRef<Tag[] | null>(null)

  useEffect(() => {
    let cancelled = false

    api
      .listTags()
      .then((records) => Promise.all(records.map(decryptTag)))
      .then((decrypted) => {
        if (cancelled) return
        knownTags.current = decrypted
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
    const known = knownTags.current
    if (!known) throw new Error('Tags are still loading. Please try again.')

    const normalized = normalize(content)
    const existing = normalized && known.find((tag) => !tag.unreadable && normalize(tag.content) === normalized)
    if (existing) return existing

    const encrypted = await encryptTagContent(content)
    const record = await api.createTag(encrypted, color)
    const tag: Tag = { id: record.id, content: content.trim(), color: record.color }
    knownTags.current = [...(knownTags.current ?? []), tag]
    setTags(knownTags.current)
    return tag
  }, [])

  return { tags, error, create }
}
