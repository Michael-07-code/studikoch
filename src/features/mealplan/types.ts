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

// Schlüssel je Slot: "<Tagindex 0-6>-<Mahlzeit>", z. B. "0-fruehstueck".
export type WeeklyPlanSlots = Record<string, WeeklyPlanSlot | null>

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
