import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveCredentials, encryptWithKey, generateWrappedDataKey } from '../lib/crypto'
import { clearDataKey, setDataKey } from '../lib/keystore'
import { JournalPage } from './JournalPage'
import styles from './JournalPage.module.css'

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

const journal = { id: 3, title: 'Morning Pages', createdAt: '2026-01-01T00:00:00.000Z' }

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

function stubPages(pages: Record<number, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => json(pages[Number(new URL(path, 'http://x').searchParams.get('page'))])),
  )
}

function renderPage(overrides: Partial<Parameters<typeof JournalPage>[0]> = {}) {
  return render(
    <JournalPage journal={journal} onBack={vi.fn()} onNewEntry={vi.fn()} onOpenEntry={vi.fn()} {...overrides} />,
  )
}

describe('JournalPage', () => {
  it('shows the decrypted journal title in the header', () => {
    stubPages({ 1: { entries: [], next_page: null } })
    renderPage()

    expect(screen.getByRole('heading', { name: 'Morning Pages' })).toBeInTheDocument()
  })

  it('renders the empty state for a journal with zero entries', async () => {
    stubPages({ 1: { entries: [], next_page: null } })
    renderPage()

    expect(await screen.findByText('No entries yet.')).toBeInTheDocument()
  })

  it('renders decrypted entry titles, with a placeholder for untitled entries', async () => {
    stubPages({
      1: {
        entries: [
          { id: 1, title: await encryptWithKey('Feeling steady today', dataKey), entry_date: '2026-09-06' },
          { id: 2, title: await encryptWithKey('', dataKey), entry_date: '2026-09-05' },
          { id: 3, title: await encryptWithKey('Untitled', dataKey), entry_date: '2026-09-04' },
        ],
        next_page: null,
      },
    })
    renderPage()

    expect(await screen.findByText('Feeling steady today')).toBeInTheDocument()
    expect(screen.queryByText('No entries yet.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()

    // Two spans can render the same text ("Untitled") for different reasons —
    // one is the blank-title placeholder, the other is a real title that
    // happens to read "Untitled" — so distinguish them by class, not text.
    const untitledSpans = screen.getAllByText('Untitled')
    expect(untitledSpans).toHaveLength(2)
    expect(untitledSpans.filter((span) => span.className === styles.itemUntitled)).toHaveLength(1)
    expect(untitledSpans.filter((span) => span.className === styles.itemTitle)).toHaveLength(1)
  })

  it('keeps the rest of the list usable when one title will not decrypt', async () => {
    stubPages({
      1: {
        entries: [
          { id: 1, title: await encryptWithKey('Feeling steady today', dataKey), entry_date: '2026-09-06' },
          { id: 2, title: 'bm90IGEgcmVhbCBlbnZlbG9wZSwgdGFtcGVyZWQ=', entry_date: '2026-09-05' },
        ],
        next_page: null,
      },
    })
    renderPage()

    expect(await screen.findByText('Feeling steady today')).toBeInTheDocument()
    expect(screen.getByText('Unable to decrypt')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('loads the next page on demand', async () => {
    const user = userEvent.setup()
    stubPages({
      1: { entries: [{ id: 1, title: await encryptWithKey('Sep 6', dataKey), entry_date: '2026-09-06' }], next_page: 2 },
      2: { entries: [{ id: 2, title: await encryptWithKey('Sep 5', dataKey), entry_date: '2026-09-05' }], next_page: null },
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('Sep 5')).toBeInTheDocument()
    expect(screen.getByText('Sep 6')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('opens an entry when its row is tapped', async () => {
    const user = userEvent.setup()
    const onOpenEntry = vi.fn()
    stubPages({
      1: {
        entries: [{ id: 8, title: await encryptWithKey('Feeling steady today', dataKey), entry_date: '2026-09-06' }],
        next_page: null,
      },
    })
    renderPage({ onOpenEntry })

    await user.click(await screen.findByRole('button', { name: /Feeling steady today/ }))

    expect(onOpenEntry).toHaveBeenCalledWith(8)
  })

  it('calls onNewEntry and onBack from their buttons', async () => {
    const user = userEvent.setup()
    const onNewEntry = vi.fn()
    const onBack = vi.fn()
    stubPages({ 1: { entries: [], next_page: null } })
    renderPage({ onNewEntry, onBack })

    await user.click(screen.getByRole('button', { name: 'New entry' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(onNewEntry).toHaveBeenCalled()
    expect(onBack).toHaveBeenCalled()
  })
  describe('deleting', () => {
    const entryPage = async () => ({
      1: {
        entries: [
          { id: 1, title: await encryptWithKey('Sep 6', dataKey), entry_date: '2026-09-06' },
          { id: 2, title: await encryptWithKey('Sep 5', dataKey), entry_date: '2026-09-05' },
        ],
        next_page: null,
      },
    })

    function stubWithDelete(pages: Record<number, unknown>, deleteStatus = 204) {
      const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return new Response(deleteStatus === 204 ? null : JSON.stringify({ error: 'Not Found' }), { status: deleteStatus })
        }
        return json(pages[Number(new URL(path, 'http://x').searchParams.get('page'))])
      })
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    const deleteCalls = (fetchMock: ReturnType<typeof stubWithDelete>) =>
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')

    it('confirming removes the row and sends the delete', async () => {
      const user = userEvent.setup()
      const fetchMock = stubWithDelete(await entryPage())
      renderPage()

      await user.click(await screen.findByRole('button', { name: /Delete entry from Sep 6/ }))
      expect(screen.getByRole('dialog', { name: /Sep 6/ })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(screen.queryByText('Sep 6', { selector: 'span' })).not.toBeInTheDocument())
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Sep 5')).toBeInTheDocument()
      expect(deleteCalls(fetchMock)).toHaveLength(1)
      expect(deleteCalls(fetchMock)[0][0]).toBe('/api/journals/3/entries/1')
    })

    it('canceling deletes nothing and closes the modal', async () => {
      const user = userEvent.setup()
      const fetchMock = stubWithDelete(await entryPage())
      renderPage()

      await user.click(await screen.findByRole('button', { name: /Delete entry from Sep 6/ }))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Sep 6')).toBeInTheDocument()
      expect(screen.getByText('Sep 5')).toBeInTheDocument()
      expect(deleteCalls(fetchMock)).toHaveLength(0)
    })

    it('keeps the row and shows the error when the server refuses', async () => {
      const user = userEvent.setup()
      stubWithDelete(await entryPage(), 404)
      renderPage()

      await user.click(await screen.findByRole('button', { name: /Delete entry from Sep 6/ }))
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Not Found')
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Sep 6')).toBeInTheDocument()
    })

    it('refetches loaded pages after a delete so "load more" does not skip a row', async () => {
      const user = userEvent.setup()
      const firstPageBefore = {
        entries: [
          { id: 1, title: await encryptWithKey('Sep 6', dataKey), entry_date: '2026-09-06' },
          { id: 2, title: await encryptWithKey('Sep 5', dataKey), entry_date: '2026-09-05' },
        ],
        next_page: 2,
      }
      const firstPageAfter = {
        entries: [
          { id: 2, title: await encryptWithKey('Sep 5', dataKey), entry_date: '2026-09-05' },
          { id: 3, title: await encryptWithKey('Sep 4', dataKey), entry_date: '2026-09-04' },
        ],
        next_page: 2,
      }
      let deleted = false
      vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            deleted = true
            return new Response(null, { status: 204 })
          }
          const page = Number(new URL(path, 'http://x').searchParams.get('page'))
          if (page === 1) return json(deleted ? firstPageAfter : firstPageBefore)
          return json({ entries: [{ id: 4, title: await encryptWithKey('Sep 3', dataKey), entry_date: '2026-09-03' }], next_page: null })
        }),
      )
      renderPage()

      await user.click(await screen.findByRole('button', { name: /Delete entry from Sep 6/ }))
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText('Sep 4')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Load more' }))

      expect(await screen.findByText('Sep 3')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(3)
    })
  })
})
