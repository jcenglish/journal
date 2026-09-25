import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveCredentials, encryptWithKey, generateWrappedDataKey } from '../lib/crypto'
import { clearDataKey, setDataKey } from '../lib/keystore'
import { JournalPage } from './JournalPage'

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
        ],
        next_page: null,
      },
    })
    renderPage()

    expect(await screen.findByText('Feeling steady today')).toBeInTheDocument()
    expect(screen.getByText('Untitled')).toBeInTheDocument()
    expect(screen.queryByText('No entries yet.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
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
})
