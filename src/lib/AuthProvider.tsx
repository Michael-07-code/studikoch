import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

interface AuthContextValue {
  session: Session | null
  // true, solange der initiale Login-Status noch geladen wird (verhindert
  // ein kurzes Aufblitzen der Login-Seite bei bereits angemeldeten
  // Nutzer:innen).
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
})

/**
 * Hält den Supabase-Login-Status (Session) für die gesamte App bereit.
 * Ohne konfiguriertes Supabase (siehe supabaseClient.ts) bleibt die
 * Session dauerhaft "null" und loading wird sofort false.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session)
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
      },
    )

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
