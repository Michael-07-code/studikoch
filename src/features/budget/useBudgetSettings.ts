import { useUserSettings } from '../../lib/useUserSettings'
import { normalizeBudgetSettings, type BudgetSettings } from './types'

/**
 * Budget-Einstellungen (Tages-/Wochenbudget, Aufteilung nach Mahlzeit) –
 * liegt in Supabase (user_settings.budget_settings), damit sie auf allen
 * Geräten gleich sind.
 */
export function useBudgetSettings() {
  const { settings, patch, loading } = useUserSettings()

  const budgetSettings: BudgetSettings = normalizeBudgetSettings(
    settings?.budget_settings as Partial<BudgetSettings> | null,
  )

  function updateSettings(p: Partial<BudgetSettings>) {
    patch({ budget_settings: { ...budgetSettings, ...p } })
  }

  return { settings: budgetSettings, updateSettings, loading }
}
