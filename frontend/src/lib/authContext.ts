import { createContext } from 'react'

export interface AuthUser {
  id: number
  email: string
}

export interface AuthContextValue {
  user: AuthUser | null
  logIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logOut: () => Promise<void>
}

// Deliberately carries no CryptoKey. The key lives only in the keystore module,
// so it can't be reached through a devtools state snapshot or a serialized tree.
export const AuthContext = createContext<AuthContextValue | null>(null)
