import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthProvider'

export interface UserSettingsRow {
  user_id: string
  // Alle drei Felder sind einfach freie JSON-Objekte – wir speichern
  // dieselben Strukturen, die vorher als eigene localStorage-Keys lagen
  // (Preisbuch, Rezept-Einstellungen, Budget-Einstellungen), jetzt
  // gebündelt in einer einzigen Zeile pro Nutzer. "unknown" statt eines
  // konkreten Typs, damit jeder Consumer-Hook selbst (per Cast) festlegt,
  // welche Form sein Feld hat, ohne TypeScript-Zuweisungskonflikte an
  // dieser zentralen Stelle.
  price_book: unknown
  recipe_preferences: unknown
  budget_settings: unknown
  weekly_plan: unknown
}

const EMPTY_SETTINGS: Omit<UserSettingsRow, 'user_id'> = {
  price_book: {},
  recipe_preferences: null,
  budget_settings: null,
  weekly_plan: null,
}

/**
 * Ein einziger Datensatz pro Nutzer für alle kleinen Einstellungs-"Blobs"
 * der App. Wird von useShoppingList (price_book), useRecipePreferences
 * (recipe_preferences) und useBudgetSettings (budget_settings) genutzt.
 */
export function useUserSettings() {
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
      .then(({ data }) => {
        if (cancelled) return
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
      await supabase.from('user_settings').upsert(
        {
          user_id: session.user.id,
          ...fields,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
    },
    [session],
  )

  return { settings, patch, loading }
}
