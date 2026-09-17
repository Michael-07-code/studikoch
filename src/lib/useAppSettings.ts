import { useCallback } from 'react'
import { useUserSettings } from './useUserSettings'

// Kleine Verhaltens-Einstellungen der App, die nirgendwo sonst thematisch
// hinpassen (siehe user_settings.app_settings in supabase/schema.sql).
export interface AppSettings {
  // Beim Speichern eines Rezepts gleich nach Frühstück/Mittag/Abend fragen
  // (true, Standard) oder es einfach auf "sonstiges" belassen (false) –
  // Nutzerwunsch: einstellbar, statt fest vorgegeben.
  askMealTypeOnSave: boolean
  // Bevorzugter Supermarkt für die Einkaufsliste: neue Artikel werden mit
  // dem Preis in diesem Supermarkt angelegt, statt jeweils dem einzeln
  // günstigsten Laden über mehrere Märkte verteilt zu werden.
  preferredSupermarketId: string | null
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  askMealTypeOnSave: true,
  preferredSupermarketId: null,
}

export function useAppSettings() {
  const { settings, patch, loading } = useUserSettings()

  const raw = (settings?.app_settings as Partial<AppSettings> | null) ?? null
  const appSettings: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    ...raw,
  }

  const updateAppSettings = useCallback(
    (patchValue: Partial<AppSettings>) => {
      return patch({ app_settings: { ...appSettings, ...patchValue } })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch, appSettings.askMealTypeOnSave, appSettings.preferredSupermarketId],
  )

  return { appSettings, updateAppSettings, loading }
}
