import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthProvider'

export interface UserSettingsRow {
  user_id: string
  price_book: unknown
  recipe_preferences: unknown
  budget_settings: unknown
  weekly_plan: unknown
  app_settings: unknown
}

const EMPTY_SETTINGS: Omit<UserSettingsRow, 'user_id'> = {
  price_book: {},
  recipe_preferences: null,
  budget_settings: null,
  weekly_plan: null,
  app_settings: null,
}

interface UserSettingsContextValue {
  settings: UserSettingsRow | null
  patch: (fields: Partial<Omit<UserSettingsRow, 'user_id'>>) => Promise<void>
  loading: boolean
}

const UserSettingsContext = createContext<UserSettingsContextValue | null>(
  null,
)

// Einmalig ganz oben (siehe App.tsx) um die App gelegt: EIN gemeinsamer
// Zustand für alle Einstellungen (Hell/Dunkel, Budget, Rezept-Präferenzen,
// Wochenplan, …), statt dass jede Stelle, die useUserSettings() aufruft,
// ihre eigene, unabhängige Kopie aus Supabase lädt. Genau das war der Grund,
// warum z. B. der Hell/Dunkel-Umschalter in den Einstellungen keine
// sichtbare Wirkung hatte: ThemeSync (in Layout) und SettingsPage hatten
// jeweils ihre eigene Instanz mit eigenem State – eine Änderung in der einen
// Instanz war der anderen schlicht nicht bekannt. Mit einem gemeinsamen
// Context sehen alle Verbraucher sofort denselben, aktuellen Stand.
export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [settings, setSettings] = useState<UserSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!supabase || !session) {
      setSettings(null)
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Einstellungen konnten nicht geladen werden:', error)
        }
        setSettings(
          (data as UserSettingsRow | null) ?? {
            user_id: session.user.id,
            ...EMPTY_SETTINGS,
          },
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const patch = useCallback(
    async (fields: Partial<Omit<UserSettingsRow, 'user_id'>>) => {
      if (!supabase || !session) return
      setSettings((prev) => ({
        user_id: session.user.id,
        ...EMPTY_SETTINGS,
        ...prev,
        ...fields,
      }))
      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: session.user.id,
          ...fields,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      if (error) {
        // Ohne diese Prüfung blieb ein fehlgeschlagenes Speichern (z. B.
        // durch eine RLS-Regel oder einen Netzwerkfehler) unbemerkt – die
        // Oberfläche zeigte den neuen Wert (optimistisches Update oben),
        // obwohl er nie in der Datenbank ankam und nach einem Neuladen
        // wieder verschwand ("das Häkchen bleibt nicht").
        console.error('Einstellungen konnten nicht gespeichert werden:', error)
      }
    },
    [session],
  )

  return (
    <UserSettingsContext.Provider value={{ settings, patch, loading }}>
      {children}
    </UserSettingsContext.Provider>
  )
}

export function useUserSettings(): UserSettingsContextValue {
  const ctx = useContext(UserSettingsContext)
  if (!ctx) {
    throw new Error('useUserSettings() muss innerhalb von <UserSettingsProvider> verwendet werden.')
  }
  return ctx
}
