import { describe, expect, it, vi } from 'vitest'
import { clearDraft, draftKey, loadDraft, storeDraft, type StoredDraft } from './drafts'

const stored: StoredDraft = {
  draft: {
    entryDate: '2026-09-05',
    title: 'Sep 5',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    mood: 2,
    health: null,
    tagIds: [4],
  },
  serverId: null,
}

describe('drafts', () => {
  it('scopes the key by user, journal, and entry', () => {
    expect(draftKey(1, 3, 9)).not.toBe(draftKey(2, 3, 9))
    expect(draftKey(1, 3, 9)).not.toBe(draftKey(1, 4, 9))
    expect(draftKey(1, 3, 9)).not.toBe(draftKey(1, 3, null))
  })

  it('round-trips a draft and clears it', () => {
    storeDraft('k', stored)
    expect(loadDraft('k')).toEqual(stored)

    clearDraft('k')
    expect(loadDraft('k')).toBeNull()
  })

  it('ignores corrupt or wrongly shaped values', () => {
    localStorage.setItem('k', '{not json')
    expect(loadDraft('k')).toBeNull()

    localStorage.setItem('k', JSON.stringify({ draft: { title: 1 }, serverId: null }))
    expect(loadDraft('k')).toBeNull()

    localStorage.setItem('k', JSON.stringify({ ...stored, draft: { ...stored.draft, content: { type: 'bogus' } } }))
    expect(loadDraft('k')).toBeNull()

    localStorage.setItem('k', JSON.stringify({ ...stored, draft: { ...stored.draft, mood: 'high' } }))
    expect(loadDraft('k')).toBeNull()
  })

  it('reports whether the draft was written, without throwing when storage is unavailable', () => {
    expect(storeDraft('k', stored)).toBe(true)

    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    expect(storeDraft('k', stored)).toBe(false)

    blocked.mockRestore()
  })
})
