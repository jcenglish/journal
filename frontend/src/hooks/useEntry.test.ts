import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveCredentials, generateWrappedDataKey } from '../lib/crypto'
import { encryptEntry, type EntryDraft } from '../lib/entries'
import { clearDataKey, setDataKey } from '../lib/keystore'
import { useEntry } from './useEntry'

beforeEach(async () => {
  const { wrapKey } = await deriveCredentials('one@example.com', 'correct horse battery', { iterations: 1_000 })
  setDataKey((await generateWrappedDataKey(wrapKey)).dataKey)
})

afterEach(() => {
  clearDataKey()
  vi.unstubAllGlobals()
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Good energy, long walk' }] }],
}

const draft: EntryDraft = { entryDate: '2026-09-03', title: 'Sep 3', content, mood: 5, health: 3 }

async function record(id: number, from: EntryDraft = draft) {
  return {
    id,
    journal_id: 3,
    ...(await encryptEntry(from)),
    created_at: '2026-09-03T12:00:00.000Z',
    updated_at: '2026-09-03T12:00:00.000Z',
  }
}

describe('useEntry', () => {
  it('does not fetch for a new entry', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useEntry(3, null))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.entry).toBeNull()
  })

  it('loads and decrypts an existing entry', async () => {
    const stored = await record(9)
    const fetchMock = vi.fn(async () => json(stored))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useEntry(3, 9))
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.entry).not.toBeNull())
    expect(result.current.entry).toEqual({ id: 9, title: 'Sep 3', content, mood: 5, health: 3, entryDate: '2026-09-03' })
    expect(result.current.loading).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith('/api/journals/3/entries/9', expect.anything())
  })

  it('surfaces a 404 for an entry the user cannot access', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Not Found' }, 404)))

    const { result } = renderHook(() => useEntry(3, 99))

    await waitFor(() => expect(result.current.error).toBe('Not Found'))
    expect(result.current.loading).toBe(false)
  })

  it('creates a new entry by POSTing only ciphertext', async () => {
    const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => json(JSON.parse(String(init?.body)).entry, 201))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useEntry(3, null))

    await act(() => result.current.save(draft))

    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/api/journals/3/entries')
    expect(init?.method).toBe('POST')
    const body = String(init?.body)
    expect(body).not.toContain('Good energy')
    expect(body).not.toContain('Sep 3')
    const { entry } = JSON.parse(body)
    expect(entry.mood).not.toBe('5')
    expect(entry.health).not.toBe('3')
  })

  it('updates an existing entry with PATCH', async () => {
    const stored = await record(9)
    const fetchMock = vi.fn<typeof fetch>(async () => json(stored))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useEntry(3, 9))
    await waitFor(() => expect(result.current.entry).not.toBeNull())

    await act(() => result.current.save({ ...draft, mood: 1 }))

    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toBe('/api/journals/3/entries/9')
    expect(init?.method).toBe('PATCH')
  })

  it('rejects an out-of-range rating without sending anything', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useEntry(3, null))

    await expect(result.current.save({ ...draft, mood: 6 })).rejects.toThrow('Please choose a mood from 1 to 5.')
    await expect(result.current.save({ ...draft, health: 0 })).rejects.toThrow(
      'Please choose a health rating from 1 to 5.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
