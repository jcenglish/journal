import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deriveCredentials, encryptWithKey, generateWrappedDataKey } from '../lib/crypto'
import { clearDataKey, setDataKey } from '../lib/keystore'
import { useTags } from './useTags'

const unlock = async () => {
  const { wrapKey } = await deriveCredentials('one@example.com', 'correct horse battery', { iterations: 1_000 })
  const { dataKey } = await generateWrappedDataKey(wrapKey)
  setDataKey(dataKey)
  return dataKey
}

afterEach(() => {
  clearDataKey()
  vi.unstubAllGlobals()
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('useTags', () => {
  it('fetches and decrypts the current user\'s tags', async () => {
    const dataKey = await unlock()
    const envelope = await encryptWithKey('gratitude', dataKey)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json([{ id: 1, content: envelope, color: '#2563eb', created_at: '2026-01-01T00:00:00.000Z' }])),
    )

    const { result } = renderHook(() => useTags())

    await waitFor(() => expect(result.current.tags).not.toBeNull())
    expect(result.current.tags).toEqual([{ id: 1, content: 'gratitude', color: '#2563eb' }])
    expect(result.current.error).toBeNull()
  })

  it('surfaces a fetch error', async () => {
    await unlock()
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Unauthorized' }, 401)))

    const { result } = renderHook(() => useTags())

    await waitFor(() => expect(result.current.error).toBe('Unauthorized'))
    expect(result.current.tags).toBeNull()
  })

  it('marks a tag whose content will not decrypt as unreadable instead of throwing', async () => {
    await unlock()
    const otherKey = (
      await generateWrappedDataKey(
        (await deriveCredentials('two@example.com', 'another password', { iterations: 1_000 })).wrapKey,
      )
    ).dataKey
    const envelope = await encryptWithKey('not yours', otherKey)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json([{ id: 1, content: envelope, color: '#2563eb', created_at: '2026-01-01T00:00:00.000Z' }])),
    )

    const { result } = renderHook(() => useTags())

    await waitFor(() => expect(result.current.tags).not.toBeNull())
    expect(result.current.tags).toEqual([{ id: 1, content: '', color: '#2563eb', unreadable: true }])
  })

  it('creates a tag by sending ciphertext and appends the plaintext locally', async () => {
    await unlock()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_path: string, init?: RequestInit) => {
        if (init?.method !== 'POST') return json([])

        const body = JSON.parse(String(init.body)) as { tag: { content: string; color: string } }
        expect(body.tag.content).not.toBe('gratitude')
        return json({ id: 3, content: body.tag.content, color: body.tag.color, created_at: '2026-01-02T00:00:00.000Z' }, 201)
      }),
    )

    const { result } = renderHook(() => useTags())
    await waitFor(() => expect(result.current.tags).toEqual([]))

    let created
    await act(async () => {
      created = await result.current.create('gratitude', '#2563eb')
    })

    expect(created).toEqual({ id: 3, content: 'gratitude', color: '#2563eb' })
    expect(result.current.tags).toEqual([{ id: 3, content: 'gratitude', color: '#2563eb' }])
  })

  it('rejects a blank tag name before sending anything', async () => {
    await unlock()
    const fetchMock = vi.fn(async () => json([]))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useTags())
    await waitFor(() => expect(result.current.tags).toEqual([]))

    await expect(result.current.create('   ', '#2563eb')).rejects.toThrow('Please enter a tag name.')
    expect(fetchMock).toHaveBeenCalledTimes(1) // only the initial list fetch
  })
})
