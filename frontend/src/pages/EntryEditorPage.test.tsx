import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveCredentials, encryptWithKey, generateWrappedDataKey } from '../lib/crypto'
import { clearDataKey, setDataKey } from '../lib/keystore'
import { EntryEditorPage } from './EntryEditorPage'

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

/** A fake server holding exactly what it was sent — ciphertext only. */
function stubServer() {
  const stored = new Map<number, Record<string, unknown>>()
  const tags = new Map<number, Record<string, unknown>>()
  let nextId = 1
  let nextTagId = 1
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'

    if (path.startsWith('/api/tags')) {
      if (method === 'POST') {
        const tag = { id: nextTagId++, created_at: '2026-09-05T12:00:00.000Z', ...JSON.parse(String(init?.body)).tag }
        tags.set(tag.id, tag)
        return json(tag, 201)
      }
      return json([...tags.values()])
    }

    const id = Number(path.split('/').pop())
    if (method === 'POST') {
      const entry = { id: nextId++, journal_id: 3, tag_ids: [], ...JSON.parse(String(init?.body)).entry }
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
  return { stored, tags, fetchMock }
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
    render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)

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
    const { unmount } = render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={onSaved} />)

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

    render(<EntryEditorPage userId={1} journalId={3} entryId={1} onBack={vi.fn()} onSaved={vi.fn()} />)

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
    const first = render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await fillEntry(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(stored.size).toBe(1))
    first.unmount()

    const onSaved = vi.fn()
    const second = render(<EntryEditorPage userId={1} journalId={3} entryId={1} onBack={vi.fn()} onSaved={onSaved} />)
    await user.click(
      within(await screen.findByRole('group', { name: 'Mood' })).getByRole('radio', { name: '5' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    second.unmount()

    render(<EntryEditorPage userId={1} journalId={3} entryId={1} onBack={vi.fn()} onSaved={vi.fn()} />)
    const mood = within(await screen.findByRole('group', { name: 'Mood' }))
    expect(mood.getByRole('radio', { name: '5' })).toBeChecked()
    expect(stored.size).toBe(1)
  })

  it('requires a mood and health rating before saving', async () => {
    const user = userEvent.setup()
    const { fetchMock } = stubServer()
    render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('textbox', { name: 'Content' }))
    await user.keyboard('Something happened')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please choose a mood from 1 to 5.')
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/entries'), expect.anything())
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('requires content before saving', async () => {
    const user = userEvent.setup()
    const { fetchMock } = stubServer()
    render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please write something before saving.')
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/entries'), expect.anything())
  })

  it('shows an error instead of the form for an entry that cannot be loaded', async () => {
    stubServer()
    render(<EntryEditorPage userId={1} journalId={3} entryId={42} onBack={vi.fn()} onSaved={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Not Found')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('selects an existing tag and saves it with the entry', async () => {
    const user = userEvent.setup()
    const { stored, tags } = stubServer()
    const content = await encryptWithKey('gratitude', dataKey)
    tags.set(1, { id: 1, content, color: '#2563eb', created_at: '2026-09-05T12:00:00.000Z' })
    const onSaved = vi.fn()
    render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={onSaved} />)

    await fillEntry(user)
    await user.click(await screen.findByRole('button', { name: 'Select tags' }))
    await user.click(screen.getByRole('checkbox', { name: 'gratitude' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(stored.get(1)!.tag_ids).toEqual([1])
  })

  it('creates a new tag from the entry editor and immediately selects it, without reloading', async () => {
    const user = userEvent.setup()
    const { stored, tags } = stubServer()
    const onSaved = vi.fn()
    render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={onSaved} />)

    await fillEntry(user)
    await user.click(await screen.findByRole('button', { name: 'Select tags' }))
    await user.click(screen.getByRole('button', { name: '+ New tag' }))
    await user.type(screen.getByLabelText('Name'), 'gratitude')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(tags.size).toBe(1))
    expect(screen.getByRole('button', { name: 'gratitude' })).toBeInTheDocument()
    const createdId = ([...tags.values()][0] as { id: number }).id

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(stored.get(1)!.tag_ids).toEqual([createdId])
  })

  it('calls onBack when the back button is tapped', async () => {
    const user = userEvent.setup()
    stubServer()
    const onBack = vi.fn()
    render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={onBack} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(onBack).toHaveBeenCalled()
  })

  describe('autosave', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const setupUser = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const draftsInStorage = () => Object.keys(localStorage).filter((key) => key.startsWith('journal:draft:'))

    it('restores an unsaved draft after the tab is closed and reopened before the debounce fires', async () => {
      const user = setupUser()
      const { fetchMock } = stubServer()
      const first = render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)
      await user.type(screen.getByLabelText('Title (optional)'), 'Half-written')
      await user.click(screen.getByRole('textbox', { name: 'Content' }))
      await user.keyboard('Woke up early')
      first.unmount()
      fetchMock.mockClear()

      render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)

      expect(screen.getByLabelText('Title (optional)')).toHaveValue('Half-written')
      expect(screen.getByRole('textbox', { name: 'Content' })).toHaveTextContent('Woke up early')
      expect(screen.getByText('Restored your unsaved changes.')).toBeInTheDocument()
    })

    it("does not show one user's draft to another", async () => {
      const user = setupUser()
      stubServer()
      const first = render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)
      await user.type(screen.getByLabelText('Title (optional)'), 'Private')
      first.unmount()

      render(<EntryEditorPage userId={2} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)

      expect(screen.getByLabelText('Title (optional)')).toHaveValue('')
    })

    it('saves about a second and a half after typing stops, once, then keeps updating that entry', async () => {
      const user = setupUser()
      const { stored, fetchMock } = stubServer()
      render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)
      await fillEntry(user)

      const requests = () => fetchMock.mock.calls.filter(([path]) => String(path).includes('/entries'))
      expect(requests()).toHaveLength(0)
      await act(() => vi.advanceTimersByTimeAsync(1600))
      await waitFor(() => expect(stored.size).toBe(1))

      await user.type(screen.getByLabelText('Title (optional)'), '!')
      await act(() => vi.advanceTimersByTimeAsync(1600))
      await waitFor(() => expect(requests()).toHaveLength(2))

      expect(requests().map(([, init]) => init?.method)).toEqual(['POST', 'PATCH'])
      expect(stored.size).toBe(1)
      expect(await screen.findByText('All changes saved')).toBeInTheDocument()
    })

    it('does not send an unfinished entry, but keeps it as a local draft', async () => {
      const user = setupUser()
      const { fetchMock } = stubServer()
      render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)

      await user.click(screen.getByRole('textbox', { name: 'Content' }))
      await user.keyboard('No ratings yet')
      await act(() => vi.advanceTimersByTimeAsync(1600))

      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/entries'), expect.anything())
      expect(draftsInStorage()).toHaveLength(1)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('clears the local draft once the server confirms an autosave', async () => {
      const user = setupUser()
      const { stored } = stubServer()
      render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)
      await fillEntry(user)
      expect(draftsInStorage()).toHaveLength(1)

      await act(() => vi.advanceTimersByTimeAsync(1600))

      await waitFor(() => expect(stored.size).toBe(1))
      await waitFor(() => expect(draftsInStorage()).toHaveLength(0))
    })

    it('clears the local draft once an explicit save is confirmed', async () => {
      const user = setupUser()
      const onSaved = vi.fn()
      stubServer()
      render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={onSaved} />)
      await fillEntry(user)

      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(onSaved).toHaveBeenCalled())
      expect(draftsInStorage()).toHaveLength(0)
    })

    it('keeps the draft and says so when a save fails', async () => {
      const user = setupUser()
      const { fetchMock } = stubServer()
      render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)
      fetchMock.mockImplementation(async () => json({ error: 'Server error' }, 500))
      await fillEntry(user)

      await act(() => vi.advanceTimersByTimeAsync(1600))

      expect(await screen.findByRole('status')).toHaveTextContent('Couldn’t save')
      expect(draftsInStorage()).toHaveLength(1)
    })

    it('saves right away when the tab is hidden', async () => {
      const user = setupUser()
      const { stored } = stubServer()
      render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)
      await fillEntry(user)

      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))

      await waitFor(() => expect(stored.size).toBe(1))
    })

    it('resumes the entry an earlier autosave created instead of creating a second one', async () => {
      const user = setupUser()
      const { stored, fetchMock } = stubServer()
      const first = render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)
      await fillEntry(user)
      await act(() => vi.advanceTimersByTimeAsync(1600))
      await waitFor(() => expect(stored.size).toBe(1))
      fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
      await user.type(screen.getByLabelText('Title (optional)'), ' edited')
      first.unmount()
      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      fetchMock.mockClear()
      fetchMock.mockImplementation(async (_path, init) => {
        const entry = { ...stored.get(1), ...JSON.parse(String(init?.body)).entry }
        stored.set(1, entry)
        return json(entry)
      })

      render(<EntryEditorPage userId={1} journalId={3} entryId={null} onBack={vi.fn()} onSaved={vi.fn()} />)
      await act(() => vi.advanceTimersByTimeAsync(1600))

      const entryRequests = () => fetchMock.mock.calls.filter(([path]) => String(path).includes('/entries'))
      await waitFor(() => expect(entryRequests()).toHaveLength(1))
      expect(entryRequests()[0][0]).toBe('/api/journals/3/entries/1')
      expect(stored.size).toBe(1)
    })
  })
})
