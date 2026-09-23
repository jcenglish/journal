import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deriveCredentials, generateWrappedDataKey, encryptWithKey } from '../lib/crypto'
import { clearDataKey, setDataKey } from '../lib/keystore'
import { useJournals } from './useJournals'

const unlock = async () => {
  const { wrapKey } = await deriveCredentials('one@example.com', 'correct horse battery', {
    iterations: 1_000,
  })
  const { dataKey } = await generateWrappedDataKey(wrapKey)
  setDataKey(dataKey)
  return dataKey
}

afterEach(() => {
  clearDataKey()
  vi.unstubAllGlobals()
})

describe('useJournals', () => {
  it('does not fetch while disabled', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useJournals(false))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.journals).toBeNull()
  })

  it('fetches and decrypts journal titles', async () => {
    const dataKey = await unlock()
    const envelope = await encryptWithKey('Morning Pages', dataKey)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify([{ id: 1, title: envelope, created_at: '2026-01-01T00:00:00.000Z' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const { result } = renderHook(() => useJournals(true))

    await waitFor(() => expect(result.current.journals).not.toBeNull())

    expect(result.current.journals).toEqual([
      { id: 1, title: 'Morning Pages', createdAt: '2026-01-01T00:00:00.000Z' },
    ])
    expect(result.current.error).toBeNull()
  })

  it('surfaces a fetch error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
    )

    const { result } = renderHook(() => useJournals(true))

    await waitFor(() => expect(result.current.error).toBe('Unauthorized'))
    expect(result.current.journals).toBeNull()
  })

  it('clears journals when disabled, so a re-login as someone else never renders a stale list', async () => {
    const dataKey = await unlock()
    const envelope = await encryptWithKey('Morning Pages', dataKey)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify([{ id: 1, title: envelope, created_at: '2026-01-01T00:00:00.000Z' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const { result, rerender } = renderHook(({ enabled }) => useJournals(enabled), {
      initialProps: { enabled: true },
    })
    await waitFor(() => expect(result.current.journals).not.toBeNull())

    rerender({ enabled: false })

    expect(result.current.journals).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('creates a journal by sending ciphertext and appends the plaintext locally', async () => {
    await unlock()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_path: string, init?: RequestInit) => {
        if (init?.method !== 'POST') {
          return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
        }

        const body = JSON.parse(String(init.body)) as { journal: { title: string } }
        expect(body.journal.title).not.toBe('Gratitude Log')
        return new Response(
          JSON.stringify({ id: 2, title: body.journal.title, created_at: '2026-01-02T00:00:00.000Z' }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }),
    )

    const { result } = renderHook(() => useJournals(true))
    await waitFor(() => expect(result.current.journals).toEqual([]))

    await act(async () => {
      await result.current.create('Gratitude Log')
    })

    expect(result.current.journals).toEqual([
      { id: 2, title: 'Gratitude Log', createdAt: '2026-01-02T00:00:00.000Z' },
    ])
  })
})
