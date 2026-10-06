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

const draft: EntryDraft = { entryDate: '2026-09-03', title: 'Sep 3', content, mood: 5, health: 3, tagIds: [] }

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
    expect(result.current.entry).toEqual({
      id: 9,
      title: 'Sep 3',
      content,
      mood: 5,
      health: 3,
      entryDate: '2026-09-03',
      tagIds: [],
    })
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
    for (const field of [entry.title, entry.content, entry.mood, entry.health]) {
      expect(field).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(field.length).toBeGreaterThan(20)
    }
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

  describe('save sequencing', () => {
    function deferredServer() {
      const resolvers: Array<(response: Response) => void> = []
      const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => resolvers.push(resolve)))
      vi.stubGlobal('fetch', fetchMock)
      return { fetchMock, respond: (index: number, body: unknown) => resolvers[index](json(body, 200)) }
    }

    const titled = (title: string): EntryDraft => ({ ...draft, title })
    const sentBody = (fetchMock: ReturnType<typeof deferredServer>['fetchMock'], index: number) =>
      JSON.parse(String(fetchMock.mock.calls[index][1]?.body)).entry

    it('holds a newer save until the older one resolves, so the newer content wins', async () => {
      const { fetchMock, respond } = deferredServer()
      const { result } = renderHook(() => useEntry(3, 9))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      respond(0, await record(9))
      await waitFor(() => expect(result.current.entry).not.toBeNull())

      let older!: Promise<number>
      let newer!: Promise<number>
      act(() => {
        older = result.current.save(titled('older'))
      })
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      act(() => {
        newer = result.current.save(titled('newer'))
      })
      await act(async () => {})
      expect(fetchMock).toHaveBeenCalledTimes(2)

      await act(async () => respond(1, await record(9, titled('older'))))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
      await act(async () => respond(2, await record(9, titled('newer'))))
      await act(async () => {
        await Promise.all([older, newer])
      })

      expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(['GET', 'PATCH', 'PATCH'])
      expect(sentBody(fetchMock, 1).title).not.toBe(sentBody(fetchMock, 2).title)
    })

    it('collapses saves requested during a request into one follow-up with the newest draft', async () => {
      const { fetchMock, respond } = deferredServer()
      const { result } = renderHook(() => useEntry(3, null))

      let first!: Promise<number>
      act(() => {
        first = result.current.save(titled('one'))
      })
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      const second = result.current.save(titled('two'))
      const third = result.current.save(titled('three'))
      expect(third).toBe(second)

      await act(async () => respond(0, { ...(await record(21, titled('one'))) }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      await act(async () => respond(1, { ...(await record(21, titled('three'))) }))
      await act(async () => {
        await Promise.all([first, second])
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('creates a new entry once, then updates it', async () => {
      const { fetchMock, respond } = deferredServer()
      const { result } = renderHook(() => useEntry(3, null))

      let first!: Promise<number>
      let second!: Promise<number>
      act(() => {
        first = result.current.save(titled('one'))
      })
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      act(() => {
        second = result.current.save(titled('two'))
      })
      await act(async () => respond(0, await record(21, titled('one'))))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      await act(async () => respond(1, await record(21, titled('two'))))

      await expect(first).resolves.toBe(21)
      await expect(second).resolves.toBe(21)
      expect(fetchMock.mock.calls.map(([path, init]) => `${init?.method} ${path}`)).toEqual([
        'POST /api/journals/3/entries',
        'PATCH /api/journals/3/entries/21',
      ])
    })

    it('continues an entry an earlier session already created instead of creating another', async () => {
      const fetchMock = vi.fn<typeof fetch>(async () => json(await record(21)))
      vi.stubGlobal('fetch', fetchMock)
      const { result } = renderHook(() => useEntry(3, null, 21))

      await act(() => result.current.save(draft))

      expect(fetchMock.mock.calls[0][0]).toBe('/api/journals/3/entries/21')
      expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH')
    })

    it('creates a fresh entry when the one a draft was resuming has been deleted', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ error: 'Not Found' }, 404))
        .mockResolvedValueOnce(json(await record(30), 201))
      vi.stubGlobal('fetch', fetchMock)
      const { result } = renderHook(() => useEntry(3, null, 21))

      await expect(act(() => result.current.save(draft))).resolves.toBe(30)

      expect(fetchMock.mock.calls.map(([path, init]) => `${init?.method} ${path}`)).toEqual([
        'PATCH /api/journals/3/entries/21',
        'POST /api/journals/3/entries',
      ])
    })

    it('does not fall back to creating when an existing entry opened for editing is missing', async () => {
      const stored = await record(9)
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json(stored))
        .mockResolvedValueOnce(json({ error: 'Not Found' }, 404))
      vi.stubGlobal('fetch', fetchMock)
      const { result } = renderHook(() => useEntry(3, 9))
      await waitFor(() => expect(result.current.entry).not.toBeNull())

      await expect(act(() => result.current.save(draft))).rejects.toThrow('Not Found')

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('keeps saving after a failed save', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ error: 'boom' }, 500))
        .mockResolvedValueOnce(json(await record(21)))
      vi.stubGlobal('fetch', fetchMock)
      const { result } = renderHook(() => useEntry(3, null))

      await expect(act(() => result.current.save(draft))).rejects.toThrow('boom')
      await act(() => result.current.save(draft))

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
