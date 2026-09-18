import type { BudgetMealType } from '../budget/types'

export type { BudgetMealType }

export const PLAN_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
export type PlanDay = (typeof PLAN_DAYS)[number]

// Der Wochenplan zeigt weiterhin drei echte Mahlzeiten pro Tag (man isst ja
// dreimal), auch wenn die Kategorisierung selbst (siehe budget/types.ts,
// recipes/savedTypes.ts) auf zwei reduziert wurde – Frühstück bleibt
// eigenständig, Mittag- und Abendessen teilen sich nur die Kategorie
// "Hauptmahlzeit" (gleicher Budget-Topf, gleiche Rezeptsuche), bekommen im
// Plan aber weiterhin je einen eigenen, unabhängigen Vorschlag.
export const PLAN_SLOT_TYPES = ['fruehstueck', 'mittagessen', 'abendessen'] as const
export type PlanSlotType = (typeof PLAN_SLOT_TYPES)[number]

export const PLAN_SLOT_LABELS: Record<PlanSlotType, string> = {
  fruehstueck: 'Frühstück',
  mittagessen: 'Mittagessen',
  abendessen: 'Abendessen',
}

export const PLAN_SLOT_TO_BUDGET_MEAL: Record<PlanSlotType, BudgetMealType> = {
  fruehstueck: 'fruehstueck',
  mittagessen: 'hauptmahlzeit',
  abendessen: 'hauptmahlzeit',
}

export interface WeeklyPlanSlot {
  recipeId?: string
  recipeName?: string
  recipeThumbnail?: string
  estimatedCostEuro?: number
  prepTimeMinutes?: number
  // Explizit "ich esse hier nichts" – getrennt von "noch kein Vorschlag
  // zugewiesen" (slot === null). Ein vorher zugewiesenes Rezept bleibt dabei
  // in recipeId/recipeName/… erhalten, damit "doch etwas essen" es wieder
  // herstellt, statt den Slot leer zurückzulassen.
  skipped?: boolean
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

export function slotKey(day: number, slotType: PlanSlotType): string {
  return `${day}-${slotType}`
}

// Hat der Slot ein zugewiesenes, aktuell aktives (nicht übersprungenes)
// Rezept? Wird für "Ansehen"/"Tauschen", die Kostensumme und die
// Einkaufslisten-Übernahme gebraucht.
export function isFilledSlot(
  value: WeeklyPlanSlot | null | undefined,
): value is WeeklyPlanSlot & { recipeId: string } {
  return !!value && !!value.recipeId && !value.skipped
}

// Frühere Versionen kannten noch "mittagessen"/"abendessen" als eigene
// Budget-Kategorien mit jeweils eigenem slotKey-Suffix, und der Wochenplan
// hatte zwischenzeitlich nur "fruehstueck"/"hauptmahlzeit" als Slot-Typen.
// Ein zu keinem der aktuellen PLAN_SLOT_TYPES passender, bereits
// gespeicherter Slot passt zu keinem aktuellen slotKey() mehr und würde
// sonst als "unsichtbarer", aber in der Kostensumme weiterhin mitgezählter
// Karteileichen-Eintrag bestehen bleiben. Beim Lesen daher auf die
// aktuellen Schlüssel begrenzen.
const CURRENT_KEY_PATTERN = /-(?:fruehstueck|mittagessen|abendessen)$/

export function sanitizePlanSlots(slots: WeeklyPlanSlots): WeeklyPlanSlots {
  const result: WeeklyPlanSlots = {}
  for (const [key, value] of Object.entries(slots)) {
    if (CURRENT_KEY_PATTERN.test(key)) {
      result[key] = value
    }
  }
  return result
}
