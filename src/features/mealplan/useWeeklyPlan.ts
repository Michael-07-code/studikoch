import { useUserSettings } from '../../lib/useUserSettings'
import { EMPTY_WEEKLY_PLAN, type WeeklyPlan, type WeeklyPlanSlot } from './types'

/**
 * Wochenplan (welches Rezept an welchem Tag/welcher Mahlzeit) – liegt wie
 * die Budget-Einstellungen in Supabase (user_settings.weekly_plan), damit
 * er auf allen Geräten gleich ist.
 */
export function useWeeklyPlan() {
  const { settings, patch, loading } = useUserSettings()

  const plan: WeeklyPlan = {
    ...EMPTY_WEEKLY_PLAN,
    ...((settings?.weekly_plan as Partial<WeeklyPlan> | null) ?? {}),
  }

  function updatePlan(p: Partial<WeeklyPlan>) {
    patch({ weekly_plan: { ...plan, ...p } })
  }

  function setSlot(key: string, slot: WeeklyPlanSlot | null) {
    updatePlan({ slots: { ...plan.slots, [key]: slot } })
  }

  function setManySlots(entries: Record<string, WeeklyPlanSlot | null>) {
    updatePlan({ slots: { ...plan.slots, ...entries } })
  }

  function clearPlan() {
    updatePlan({ slots: {} })
  }

  return { plan, updatePlan, setSlot, setManySlots, clearPlan, loading }
}
