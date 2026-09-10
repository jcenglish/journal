import { useEffect, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import { AuthContext, type AuthUser } from '../lib/authContext'
import { deriveCredentials, generateWrappedDataKey, normalizeEmail, unwrapDataKey } from '../lib/crypto'
import { clearDataKey, hasDataKey, setDataKey } from '../lib/keystore'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  // A reload keeps the session cookie but loses the in-memory key, leaving a
  // session that can't decrypt anything. Rather than carry a third
  // "authenticated but locked" state through every screen, end the session and
  // send the user back to the Auth page. See design-decisions.md.
  useEffect(() => {
    if (!hasDataKey()) void api.logOut().catch(() => {})
  }, [])

  async function logIn(email: string, password: string) {
    const { wrapKey, authHash } = await deriveCredentials(email, password)
    // Send the same normalized form the salt was built from. JS trim() strips
    // Unicode whitespace that Ruby's String#strip leaves behind, so sending the
    // raw value could store an address the client can never reproduce — a
    // permanent lockout on an account with no password reset.
    const account = await api.logIn(normalizeEmail(email), authHash)

    // Only after the request succeeds — a rejected login must leave no key behind.
    setDataKey(await unwrapDataKey(account.encrypted_data_key, wrapKey))
    setUser({ id: account.id, email: account.email })
  }

  async function signUp(email: string, password: string) {
    const { wrapKey, authHash } = await deriveCredentials(email, password)
    const { dataKey, blob } = await generateWrappedDataKey(wrapKey)
    const account = await api.signUp(normalizeEmail(email), authHash, blob)

    setDataKey(dataKey)
    setUser({ id: account.id, email: account.email })
  }

  async function logOut() {
    try {
      // Best effort. Ending the server session is desirable but not what makes
      // the user safe — clearing the key is, and that happens either way. A
      // network failure here isn't actionable by the user, so it isn't raised.
      await api.logOut()
    } catch {
      // Intentionally ignored; the local logout below still runs.
    } finally {
      clearDataKey()
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, logIn, signUp, logOut }}>{children}</AuthContext.Provider>
  )
}
