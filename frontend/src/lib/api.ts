/**
 * Thin fetch wrapper for the Rails API.
 *
 * Bodies are always nested under a resource key ({ user: … }, { session: … }),
 * matching the backend convention that keeps logged params unambiguous — see
 * ApplicationController. Nothing here ever handles a key or a plaintext password:
 * callers pass the already-derived auth hash.
 */

export interface AuthenticatedUser {
  id: number
  email: string
  encrypted_data_key: string
}

// title is ciphertext — an envelope string, not the readable title. The server
// only ever stores and returns it opaque.
export interface JournalRecord {
  id: number
  title: string
  created_at: string
}

// title, content, mood, and health are all ciphertext envelopes. title is
// nullable only because the column is; this client always sends an envelope,
// even for a blank title, so the server can't tell which entries have one.
export interface EntrySummaryRecord {
  id: number
  title: string | null
  entry_date: string
}

export interface EntryPageRecord {
  entries: EntrySummaryRecord[]
  next_page: number | null
}

export interface EntryRecord extends EntrySummaryRecord {
  journal_id: number
  content: string
  mood: string
  health: string
  created_at: string
  updated_at: string
}

export interface EncryptedEntryFields {
  title: string
  content: string
  mood: string
  health: string
  entry_date: string
}

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(errorMessageFrom(body) ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function errorMessageFrom(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const { error, errors } = body as { error?: unknown; errors?: unknown }
  if (typeof error === 'string') return error
  if (Array.isArray(errors) && errors.length > 0) return errors.join('. ')
  return null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    // Same-origin in both dev (via the Vite proxy) and production. A split-origin
    // deploy would need 'include' plus CORS plus SameSite=None — and a CSRF token,
    // since SameSite is what defends writes today. See design-decisions.md.
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()

  // A 500 from Rails or a 502 from an edge proxy comes back as an HTML page.
  // Parsing it blind would surface "Unexpected token '<'" to the user instead of
  // a real error, so fall back to the raw text as the body.
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!response.ok) throw new ApiError(response.status, parsed)

  return parsed as T
}

export function signUp(
  email: string,
  authHash: string,
  encryptedDataKey: string,
): Promise<AuthenticatedUser> {
  return request('POST', '/api/signup', {
    user: { email, password: authHash, encrypted_data_key: encryptedDataKey },
  })
}

export function logIn(email: string, authHash: string): Promise<AuthenticatedUser> {
  return request('POST', '/api/session', { session: { email, password: authHash } })
}

export function logOut(): Promise<null> {
  return request('DELETE', '/api/session')
}

export function me(): Promise<{ id: number; email: string }> {
  return request('GET', '/api/me')
}

export function listJournals(): Promise<JournalRecord[]> {
  return request('GET', '/api/journals')
}

export function createJournal(encryptedTitle: string): Promise<JournalRecord> {
  return request('POST', '/api/journals', { journal: { title: encryptedTitle } })
}

export function listEntries(journalId: number, page = 1): Promise<EntryPageRecord> {
  return request('GET', `/api/journals/${journalId}/entries?page=${page}`)
}

export function getEntry(journalId: number, entryId: number): Promise<EntryRecord> {
  return request('GET', `/api/journals/${journalId}/entries/${entryId}`)
}

export function createEntry(journalId: number, fields: EncryptedEntryFields): Promise<EntryRecord> {
  return request('POST', `/api/journals/${journalId}/entries`, { entry: fields })
}

export function updateEntry(
  journalId: number,
  entryId: number,
  fields: EncryptedEntryFields,
): Promise<EntryRecord> {
  return request('PATCH', `/api/journals/${journalId}/entries/${entryId}`, { entry: fields })
}
