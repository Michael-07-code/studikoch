import { useUserSettings } from '../../lib/useUserSettings'
import {
  EMPTY_WEEKLY_PLAN,
  sanitizePlanSlots,
  type WeeklyPlan,
  type WeeklyPlanSlot,
  type WeeklyPlanSlots,
} from './types'

/**
 * Wochenplan (welches Rezept an welchem Tag/welcher Mahlzeit) – liegt wie
 * die Budget-Einstellungen in Supabase (user_settings.weekly_plan), damit
 * er auf allen Geräten gleich ist.
 */
export function useWeeklyPlan() {
  const { settings, patch, loading } = useUserSettings()

  const rawPlan = (settings?.weekly_plan as Partial<WeeklyPlan> | null) ?? {}
  const plan: WeeklyPlan = {
    ...EMPTY_WEEKLY_PLAN,
    ...rawPlan,
    slots: sanitizePlanSlots(rawPlan.slots ?? {}),
  }

  function updatePlan(p: Partial<WeeklyPlan>) {
    patch({ weekly_plan: { ...plan, ...p } })
  }

  function setSlot(key: string, slot: WeeklyPlanSlot | null) {
    updatePlan({ slots: { ...plan.slots, [key]: slot } })
  }

  function setManySlots(entries: WeeklyPlanSlots) {
    updatePlan({ slots: { ...plan.slots, ...entries } })
  }

  // Markiert eine Mahlzeit explizit als "ich esse hier nichts" – bzw. macht
  // das rückgängig. Ein zuvor zugewiesenes Rezept bleibt dabei im Slot
  // erhalten (nur das "skipped"-Flag wird umgeschaltet), damit "doch etwas
  // essen" wieder das gleiche Rezept zeigt, statt den Slot leer zu lassen.
  function toggleSkip(key: string) {
    const current = plan.slots[key]
    setSlot(key, { ...current, skipped: !current?.skipped })
  }

  function clearPlan() {
    updatePlan({ slots: {} })
  }

  return {
    plan,
    updatePlan,
    setSlot,
    setManySlots,
    toggleSkip,
    clearPlan,
    loading,
  }
}
