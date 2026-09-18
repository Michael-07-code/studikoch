import type { BudgetMealType } from '../budget/types'

export type { BudgetMealType }

export const PLAN_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
export type PlanDay = (typeof PLAN_DAYS)[number]

export interface WeeklyPlanSlot {
  recipeId: string
  recipeName: string
  recipeThumbnail: string
  estimatedCostEuro?: number
  prepTimeMinutes?: number
}

// "skip" markiert bewusst "ich esse hier nichts" – anders als ein leerer
// Slot (null = noch kein Vorschlag zugewiesen), damit dieser Unterschied in
// der Kostenrechnung und der Anzeige sichtbar bleibt.
export type WeeklyPlanSlotValue = WeeklyPlanSlot | 'skip'

// Schlüssel je Slot: "<Tagindex 0-6>-<Mahlzeit>", z. B. "0-fruehstueck".
export type WeeklyPlanSlots = Record<string, WeeklyPlanSlotValue | null>

export interface WeeklyPlan {
  // "Meal-Prep": dieselben 1-2 Gerichte pro Mahlzeitentyp über die Woche
  // wiederholen, statt für jeden Tag ein eigenes Rezept zu suchen.
  mealPrepMode: boolean
  slots: WeeklyPlanSlots
}

export const EMPTY_WEEKLY_PLAN: WeeklyPlan = {
  mealPrepMode: false,
  slots: {},
}

export function slotKey(day: number, mealType: BudgetMealType): string {
  return `${day}-${mealType}`
}

export function isFilledSlot(
  value: WeeklyPlanSlotValue | null | undefined,
): value is WeeklyPlanSlot {
  return !!value && value !== 'skip'
}

// Frühere Versionen kannten noch "mittagessen"/"abendessen" als eigene
// Mahlzeiten (siehe budget/types.ts) – ein zu einer dieser beiden Kategorien
// gehörender, bereits gespeicherter Slot passt zu keinem aktuellen
// slotKey() mehr und würde sonst als "unsichtbarer", aber in der
// Kostensumme weiterhin mitgezählter Karteileichen-Eintrag bestehen
// bleiben. Beim Lesen daher auf die aktuellen Schlüssel begrenzen.
const CURRENT_KEY_PATTERN = /-(?:fruehstueck|hauptmahlzeit)$/

export function sanitizePlanSlots(slots: WeeklyPlanSlots): WeeklyPlanSlots {
  const result: WeeklyPlanSlots = {}
  for (const [key, value] of Object.entries(slots)) {
    if (CURRENT_KEY_PATTERN.test(key)) {
      result[key] = value
    }
  }
  return result
}
