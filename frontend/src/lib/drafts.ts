import type { EntryDraft } from './entries'

/**
 * Unsaved editor state, cached in localStorage as plaintext. This is a
 * deliberate tradeoff (see design-decisions.md): it guards against a crashed
 * tab at the cost of readable text on the device until the server confirms.
 */
export interface StoredDraft {
  draft: EntryDraft
  /** Set once an earlier autosave created the entry, so a restored draft updates it instead of creating a duplicate. */
  serverId: number | null
}

export function draftKey(userId: number, journalId: number, entryId: number | null): string {
  return `journal:draft:${userId}:${journalId}:${entryId ?? 'new'}`
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (typeof value !== 'object' || value === null) return false
  const { draft, serverId } = value as { draft?: Partial<EntryDraft> | null; serverId?: unknown }
  return (
    typeof draft === 'object' &&
    draft !== null &&
    typeof draft.entryDate === 'string' &&
    typeof draft.title === 'string' &&
    draft.content?.type === 'doc' &&
    (draft.mood === null || typeof draft.mood === 'number') &&
    (draft.health === null || typeof draft.health === 'number') &&
    Array.isArray(draft.tagIds) &&
    draft.tagIds.every((id) => typeof id === 'number') &&
    (serverId === null || typeof serverId === 'number')
  )
}

export function loadDraft(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return isStoredDraft(parsed) ? parsed : null
  } catch {
    return null
  }
}

// Storage can be full or blocked (private mode); the draft cache is a safety
// net, so failing to write it must never break editing. Returns whether the
// write succeeded so the caller can warn the user.
export function storeDraft(key: string, stored: StoredDraft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(stored))
    return true
  } catch {
    return false
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    return
  }
}
