import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, logIn, me } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  it('asks for JSON', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await me()

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect((init.headers as Record<string, string>).Accept).toBe('application/json')
  })

  // Rails renders public/500.html, and an edge proxy renders its own 502 page.
  // Parsing those blind would show the user a JSON syntax error.
  it('surfaces an HTML error page as an ApiError, not a parse failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<!DOCTYPE html><html><body>We\'re sorry</body></html>', { status: 500 }),
      ),
    )

    const caught = await logIn('one@example.com', 'hash').catch((error: unknown) => error)

    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(500)
    expect((caught as ApiError).message).toBe('Request failed with status 500')
  })

  it('reports validation errors from the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ errors: ['Email has already been taken'] }), { status: 422 }),
      ),
    )

    await expect(logIn('one@example.com', 'hash')).rejects.toThrow('Email has already been taken')
  })

  it('handles an empty body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))

    await expect(me()).resolves.toBeNull()
  })
})
