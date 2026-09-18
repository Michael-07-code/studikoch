import { useUserSettings } from '../../lib/useUserSettings'
import {
  EMPTY_WEEKLY_PLAN,
  sanitizePlanSlots,
  type WeeklyPlan,
  type WeeklyPlanSlots,
  type WeeklyPlanSlotValue,
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

  function setSlot(key: string, slot: WeeklyPlanSlotValue | null) {
    updatePlan({ slots: { ...plan.slots, [key]: slot } })
  }

  function setManySlots(entries: WeeklyPlanSlots) {
    updatePlan({ slots: { ...plan.slots, ...entries } })
  }

  // Markiert eine Mahlzeit explizit als "ich esse hier nichts" – bzw. macht
  // das rückgängig (zurück zu einem leeren, noch unbelegten Slot).
  function toggleSkip(key: string) {
    setSlot(key, plan.slots[key] === 'skip' ? null : 'skip')
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
