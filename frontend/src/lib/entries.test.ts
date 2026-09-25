import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveCredentials, encryptWithKey, generateWrappedDataKey } from './crypto'
import {
  decryptEntry,
  decryptEntrySummary,
  encryptEntry,
  formatEntryDate,
  hasText,
  InvalidEntryError,
  type EntryDraft,
} from './entries'
import { clearDataKey, DecryptionError, setDataKey } from './keystore'

let dataKey: CryptoKey

beforeEach(async () => {
  const { wrapKey } = await deriveCredentials('one@example.com', 'correct horse battery', { iterations: 1_000 })
  dataKey = (await generateWrappedDataKey(wrapKey)).dataKey
  setDataKey(dataKey)
})

afterEach(() => {
  clearDataKey()
  vi.restoreAllMocks()
})

const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rough morning, better by noon' }] }],
}

function draft(overrides: Partial<EntryDraft> = {}): EntryDraft {
  return { entryDate: '2026-09-05', title: 'Sep 5', content, mood: 2, health: 4, ...overrides }
}

function recordFrom(fields: Awaited<ReturnType<typeof encryptEntry>>) {
  return {
    id: 9,
    journal_id: 1,
    ...fields,
    created_at: '2026-09-05T12:00:00.000Z',
    updated_at: '2026-09-05T12:00:00.000Z',
  }
}

describe('encryptEntry', () => {
  it('encrypts content, title, mood, and health so no plaintext is sent', async () => {
    const fields = await encryptEntry(draft())
    const serialized = JSON.stringify(fields)

    expect(serialized).not.toContain('Rough morning')
    expect(serialized).not.toContain('Sep 5')
    for (const field of [fields.title, fields.content, fields.mood, fields.health]) {
      expect(field).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(field.length).toBeGreaterThan(20)
    }
    expect(fields.entry_date).toBe('2026-09-05')
  })

  it('encrypts a blank title too, so the server cannot tell which entries have one', async () => {
    const fields = await encryptEntry(draft({ title: '   ' }))

    expect(fields.title).not.toBe('')
    expect((await decryptEntry(recordFrom(fields))).title).toBe('')
  })

  it.each([0, 6, -1, 2.5, Number.NaN, null])(
    'rejects mood %s before anything is encrypted',
    async (mood) => {
      const encrypt = vi.spyOn(crypto.subtle, 'encrypt')

      await expect(encryptEntry(draft({ mood }))).rejects.toThrow(InvalidEntryError)
      expect(encrypt).not.toHaveBeenCalled()
    },
  )

  it.each([0, 6, 10, null])('rejects health %s before anything is encrypted', async (health) => {
    const encrypt = vi.spyOn(crypto.subtle, 'encrypt')

    await expect(encryptEntry(draft({ health }))).rejects.toThrow('Please choose a health rating from 1 to 5.')
    expect(encrypt).not.toHaveBeenCalled()
  })

  it('rejects a rating smuggled in as a string', async () => {
    await expect(encryptEntry(draft({ mood: '3' as unknown as number }))).rejects.toThrow(InvalidEntryError)
  })

  it('rejects empty content', async () => {
    const blank = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '  ' }] }] }

    await expect(encryptEntry(draft({ content: blank }))).rejects.toThrow('Please write something before saving.')
  })

  it('rejects a missing date', async () => {
    await expect(encryptEntry(draft({ entryDate: '' }))).rejects.toThrow('Please choose a date.')
  })
})

describe('decryptEntry', () => {
  it('round-trips every field', async () => {
    const entry = await decryptEntry(recordFrom(await encryptEntry(draft())))

    expect(entry).toEqual({ id: 9, title: 'Sep 5', content, mood: 2, health: 4, entryDate: '2026-09-05' })
  })

  it('refuses a stored rating outside 1-5', async () => {
    const fields = await encryptEntry(draft())
    const tampered = { ...recordFrom(fields), mood: await encryptWithKey('7', dataKey) }

    await expect(decryptEntry(tampered)).rejects.toThrow(DecryptionError)
  })

  it('marks a summary whose title will not decrypt as unreadable instead of throwing', async () => {
    const otherKey = (await generateWrappedDataKey(
      (await deriveCredentials('two@example.com', 'another password', { iterations: 1_000 })).wrapKey,
    )).dataKey
    const title = await encryptWithKey('Not yours', otherKey)

    expect(await decryptEntrySummary({ id: 1, title, entry_date: '2026-09-06' })).toEqual({
      id: 1,
      title: '',
      entryDate: '2026-09-06',
      unreadable: true,
    })
  })

  it('still fails a summary when no key is loaded at all', async () => {
    const title = await encryptWithKey('Feeling steady today', dataKey)
    clearDataKey()

    await expect(decryptEntrySummary({ id: 1, title, entry_date: '2026-09-06' })).rejects.toThrow(
      'No encryption key in memory',
    )
  })

  it('decrypts a list summary', async () => {
    const title = await encryptWithKey('Feeling steady today', dataKey)

    expect(await decryptEntrySummary({ id: 1, title, entry_date: '2026-09-06' })).toEqual({
      id: 1,
      title: 'Feeling steady today',
      entryDate: '2026-09-06',
    })
  })
})

describe('hasText', () => {
  it('finds text nested inside lists', () => {
    expect(
      hasText({
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] }],
          },
        ],
      }),
    ).toBe(true)
  })

  it('treats an empty paragraph as empty', () => {
    expect(hasText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(false)
  })
})

describe('formatEntryDate', () => {
  it('formats the calendar date without shifting it by the UTC offset', () => {
    expect(formatEntryDate('2026-09-06')).toBe(
      new Date(2026, 8, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    )
  })
})
