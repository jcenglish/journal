import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveCredentials, generateWrappedDataKey } from '../lib/crypto'
import { clearDataKey, setDataKey } from '../lib/keystore'
import { EntryEditorPage } from './EntryEditorPage'

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

/** A fake server holding exactly what it was sent — ciphertext only. */
function stubServer() {
  const stored = new Map<number, Record<string, unknown>>()
  let nextId = 1
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const id = Number(path.split('/').pop())
    if (method === 'POST') {
      const entry = { id: nextId++, journal_id: 3, ...JSON.parse(String(init?.body)).entry }
      stored.set(entry.id, entry)
      return json(entry, 201)
    }
    if (method === 'PATCH') {
      const entry = { ...stored.get(id), ...JSON.parse(String(init?.body)).entry }
      stored.set(id, entry)
      return json(entry)
    }
    return stored.has(id) ? json(stored.get(id)) : json({ error: 'Not Found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { stored, fetchMock }
}

async function fillEntry(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText('Date'))
  await user.type(screen.getByLabelText('Date'), '2026-09-05')
  await user.type(screen.getByLabelText('Title (optional)'), 'Sep 5')
  await user.click(screen.getByRole('textbox', { name: 'Content' }))
  await user.keyboard('Rough morning, better by noon')
  await user.click(within(screen.getByRole('group', { name: 'Mood' })).getByRole('radio', { name: '2' }))
  await user.click(within(screen.getByRole('group', { name: 'Health' })).getByRole('radio', { name: '4' }))
}

describe('EntryEditorPage', () => {
  it('defaults a new entry to today', () => {
    stubServer()
    render(<EntryEditorPage journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)

    const today = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    expect(screen.getByLabelText('Date')).toHaveValue(
      `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
    )
    expect(screen.getByRole('heading', { name: 'New Entry' })).toBeInTheDocument()
  })

  it('saves a new entry as ciphertext, then reopens it with every field intact', async () => {
    const user = userEvent.setup()
    const { stored } = stubServer()
    const onSaved = vi.fn()
    const { unmount } = render(<EntryEditorPage journalId={3} entryId={null} onBack={vi.fn()} onSaved={onSaved} />)

    await fillEntry(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const saved = stored.get(1)!
    expect(JSON.stringify(saved)).not.toContain('Rough morning')
    expect(JSON.stringify(saved)).not.toContain('Sep 5')
    expect(saved.mood).not.toBe('2')
    expect(saved.health).not.toBe('4')
    expect(saved.entry_date).toBe('2026-09-05')
    unmount()

    render(<EntryEditorPage journalId={3} entryId={1} onBack={vi.fn()} onSaved={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Edit Entry' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Title (optional)')).toHaveValue('Sep 5')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-09-05')
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveTextContent('Rough morning, better by noon')
    expect(within(screen.getByRole('group', { name: 'Mood' })).getByRole('radio', { name: '2' })).toBeChecked()
    expect(within(screen.getByRole('group', { name: 'Health' })).getByRole('radio', { name: '4' })).toBeChecked()
  })

  it('saves edits to an existing entry', async () => {
    const user = userEvent.setup()
    const { stored } = stubServer()
    const first = render(<EntryEditorPage journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await fillEntry(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(stored.size).toBe(1))
    first.unmount()

    const onSaved = vi.fn()
    const second = render(<EntryEditorPage journalId={3} entryId={1} onBack={vi.fn()} onSaved={onSaved} />)
    await user.click(
      within(await screen.findByRole('group', { name: 'Mood' })).getByRole('radio', { name: '5' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    second.unmount()

    render(<EntryEditorPage journalId={3} entryId={1} onBack={vi.fn()} onSaved={vi.fn()} />)
    const mood = within(await screen.findByRole('group', { name: 'Mood' }))
    expect(mood.getByRole('radio', { name: '5' })).toBeChecked()
    expect(stored.size).toBe(1)
  })

  it('requires a mood and health rating before saving', async () => {
    const user = userEvent.setup()
    const { fetchMock } = stubServer()
    render(<EntryEditorPage journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('textbox', { name: 'Content' }))
    await user.keyboard('Something happened')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please choose a mood from 1 to 5.')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('requires content before saving', async () => {
    const user = userEvent.setup()
    const { fetchMock } = stubServer()
    render(<EntryEditorPage journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please write something before saving.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows an error instead of the form for an entry that cannot be loaded', async () => {
    stubServer()
    render(<EntryEditorPage journalId={3} entryId={42} onBack={vi.fn()} onSaved={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Not Found')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('calls onBack when the back button is tapped', async () => {
    const user = userEvent.setup()
    stubServer()
    const onBack = vi.fn()
    render(<EntryEditorPage journalId={3} entryId={null} onBack={onBack} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(onBack).toHaveBeenCalled()
  })
})
