import { useCallback, useEffect, useRef, useState } from 'react'
import { InvalidEntryError, type EntryDraft } from '../lib/entries'
import { clearDraft, storeDraft } from '../lib/drafts'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseAutosaveOptions {
  draftKey: string
  save: (draft: EntryDraft) => Promise<number>
  /** Set when a restored draft belongs to an entry an earlier session already created. */
  initialServerId: number | null
  delayMs?: number
}

interface UseAutosaveResult {
  status: AutosaveStatus
  /** True when the last local draft write failed, so the text isn't protected against a crashed tab. */
  draftStorageFailed: boolean
  change: (draft: EntryDraft) => void
  /** Saves now. Rejects if the save fails, including when the draft isn't valid yet. */
  flush: () => Promise<void>
}

export const AUTOSAVE_DELAY_MS = 1500

export function useAutosave({
  draftKey,
  save,
  initialServerId,
  delayMs = AUTOSAVE_DELAY_MS,
}: UseAutosaveOptions): UseAutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [draftStorageFailed, setDraftStorageFailed] = useState(false)
  const latest = useRef<EntryDraft | null>(null)
  const version = useRef(0)
  const serverId = useRef(initialServerId)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const saveRef = useRef(save)

  useEffect(() => {
    saveRef.current = save
  })

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const draft = latest.current
    if (!draft) return

    const savedVersion = version.current
    setStatus('saving')
    try {
      serverId.current = await saveRef.current(draft)
    } catch (caught) {
      // An unfinished entry (no mood yet) simply stays a local draft.
      setStatus(caught instanceof InvalidEntryError ? 'idle' : 'error')
      throw caught
    }

    // Edits made while the request was in flight aren't on the server yet, so
    // their draft has to survive this confirmation.
    if (savedVersion === version.current) {
      latest.current = null
      clearDraft(draftKey)
      setDraftStorageFailed(false)
      setStatus('saved')
    } else {
      setDraftStorageFailed(!storeDraft(draftKey, { draft: latest.current!, serverId: serverId.current }))
      setStatus('idle')
    }
  }, [draftKey])

  const flushQuietly = useCallback(() => void flush().catch(() => undefined), [flush])

  const change = useCallback(
    (draft: EntryDraft) => {
      latest.current = draft
      version.current += 1
      setDraftStorageFailed(!storeDraft(draftKey, { draft, serverId: serverId.current }))
      clearTimeout(timer.current)
      timer.current = setTimeout(flushQuietly, delayMs)
    },
    [draftKey, delayMs, flushQuietly],
  )

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushQuietly()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    // Encryption is async, so the request may not start before the page goes;
    // the local draft written by change() is what actually protects the text.
    window.addEventListener('beforeunload', flushQuietly)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', flushQuietly)
      flushQuietly()
    }
  }, [flushQuietly])

  return { status, draftStorageFailed, change, flush }
}
