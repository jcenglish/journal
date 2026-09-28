import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveCredentials, encryptWithKey, generateWrappedDataKey } from '../lib/crypto'
import { clearDataKey, setDataKey } from '../lib/keystore'
import { useEntries } from './useEntries'

let dataKey: CryptoKey

beforeEach(async () => {
  const { wrapKey } = await deriveCredentials('one@example.com', 'correct horse battery', { iterations: 1_000 })
  dataKey = (await generateWrappedDataKey(wrapKey)).dataKey
  setDataKey(dataKey)
})

afterEach(() => {
  clearDataKey()
  vi.unstubAllGlobals()
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function summary(id: number, title: string, entryDate = '2026-09-06') {
  return { id, title: await encryptWithKey(title, dataKey), entry_date: entryDate }
}

describe('useEntries', () => {
  it('fetches the first page and decrypts titles', async () => {
    const fetchMock = vi.fn(async () =>
      json({ entries: [await summary(1, 'Feeling steady today')], next_page: null }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useEntries(3))

    await waitFor(() => expect(result.current.entries).not.toBeNull())
    expect(result.current.entries).toEqual([{ id: 1, title: 'Feeling steady today', entryDate: '2026-09-06' }])
    expect(result.current.hasMore).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith('/api/journals/3/entries?page=1', expect.anything())
  })

  it('returns an empty list for a journal with no entries', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ entries: [], next_page: null })))

    const { result } = renderHook(() => useEntries(3))

    await waitFor(() => expect(result.current.entries).toEqual([]))
  })

  it('appends the next page on loadMore', async () => {
    const pages: Record<string, unknown> = {
      '/api/journals/3/entries?page=1': { entries: [await summary(1, 'Sep 6')], next_page: 2 },
      '/api/journals/3/entries?page=2': { entries: [await summary(2, 'Sep 5', '2026-09-05')], next_page: null },
    }
    vi.stubGlobal('fetch', vi.fn(async (path: string) => json(pages[path])))

    const { result } = renderHook(() => useEntries(3))
    await waitFor(() => expect(result.current.hasMore).toBe(true))

    act(() => result.current.loadMore())

    await waitFor(() => expect(result.current.entries).toHaveLength(2))
    expect(result.current.entries?.map((entry) => entry.title)).toEqual(['Sep 6', 'Sep 5'])
    expect(result.current.hasMore).toBe(false)
    expect(result.current.loadingMore).toBe(false)
  })

  it('surfaces a fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Not Found' }, 404)))

    const { result } = renderHook(() => useEntries(3))

    await waitFor(() => expect(result.current.error).toBe('Not Found'))
    expect(result.current.entries).toBeNull()
  })
})
