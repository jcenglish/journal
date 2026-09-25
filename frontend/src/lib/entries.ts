import type { JSONContent } from '@tiptap/react'
import type * as api from './api'
import { DecryptionError, decrypt, encrypt } from './keystore'

export type Rating = 1 | 2 | 3 | 4 | 5

export const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5]

export interface EntrySummary {
  id: number
  title: string
  entryDate: string
  /** The title failed to decrypt — shown as such rather than failing the whole list. */
  unreadable?: boolean
}

export interface Entry extends Omit<EntrySummary, 'unreadable'> {
  content: JSONContent
  mood: Rating
  health: Rating
}

/** What the editor holds before validation — ratings may still be unset. */
export interface EntryDraft {
  entryDate: string
  title: string
  content: JSONContent
  mood: number | null
  health: number | null
}

export class InvalidEntryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidEntryError'
  }
}

export function isRating(value: unknown): value is Rating {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

const ENTRY_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/

export function emptyDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

export function hasText(node: JSONContent): boolean {
  if (node.type === 'text') return (node.text ?? '').trim() !== ''
  return (node.content ?? []).some(hasText)
}

/** Today in the user's local timezone — toISOString() would give UTC's date. */
export function todayLocal(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * The only validation these fields get. The server stores ciphertext and can't
 * check any of it — in particular there is no DB-level 1-5 range check on
 * mood/health — so this runs before anything is encrypted or sent.
 */
function validate(draft: EntryDraft): { mood: Rating; health: Rating } {
  if (!ENTRY_DATE_FORMAT.test(draft.entryDate)) throw new InvalidEntryError('Please choose a date.')
  if (!hasText(draft.content)) throw new InvalidEntryError('Please write something before saving.')
  if (!isRating(draft.mood)) throw new InvalidEntryError('Please choose a mood from 1 to 5.')
  if (!isRating(draft.health)) throw new InvalidEntryError('Please choose a health rating from 1 to 5.')
  return { mood: draft.mood, health: draft.health }
}

export async function encryptEntry(draft: EntryDraft): Promise<api.EncryptedEntryFields> {
  const { mood, health } = validate(draft)

  const [title, content, encryptedMood, encryptedHealth] = await Promise.all([
    encrypt(draft.title.trim()),
    encrypt(JSON.stringify(draft.content)),
    encrypt(String(mood)),
    encrypt(String(health)),
  ])

  return { title, content, mood: encryptedMood, health: encryptedHealth, entry_date: draft.entryDate }
}

async function decryptTitle(title: string | null): Promise<string> {
  return title === null ? '' : decrypt(title)
}

async function decryptRating(envelope: string): Promise<Rating> {
  const rating = Number(await decrypt(envelope))
  if (!isRating(rating)) throw new DecryptionError('Stored rating is out of range')
  return rating
}

export async function decryptEntrySummary(record: api.EntrySummaryRecord): Promise<EntrySummary> {
  const summary = { id: record.id, title: '', entryDate: record.entry_date }
  try {
    return { ...summary, title: await decryptTitle(record.title) }
  } catch (caught) {
    // A missing key (VaultLockedError) affects every row, so that still fails the list.
    if (!(caught instanceof DecryptionError)) throw caught
    return { ...summary, unreadable: true }
  }
}

export async function decryptEntry(record: api.EntryRecord): Promise<Entry> {
  const [title, contentJson, mood, health] = await Promise.all([
    decryptTitle(record.title),
    decrypt(record.content),
    decryptRating(record.mood),
    decryptRating(record.health),
  ])

  let content: JSONContent
  try {
    content = JSON.parse(contentJson) as JSONContent
  } catch {
    throw new DecryptionError('Stored content is not a valid document')
  }

  return { id: record.id, title, content, mood, health, entryDate: record.entry_date }
}

/** entry_date is a calendar date; parsing it as a Date would shift it by the UTC offset. */
export function formatEntryDate(entryDate: string): string {
  const [year, month, day] = entryDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
