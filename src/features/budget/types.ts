// Nutzerwunsch: nur noch zwei Kategorien statt drei – Mittag- und
// Abendessen wurden zu einer einzigen Kategorie "Hauptmahlzeit"
// zusammengelegt (siehe auch features/recipes/savedTypes.ts).
export type BudgetMealType = 'fruehstueck' | 'hauptmahlzeit'

export interface BudgetSettings {
  dailyBudget?: number
  weeklyBudget?: number
  splitByMeal: boolean
  // Anteile in Prozent, nur relevant wenn splitByMeal = true.
  mealShare: Record<BudgetMealType, number>
}

export const DEFAULT_BUDGET_SETTINGS: BudgetSettings = {
  splitByMeal: true,
  mealShare: {
    fruehstueck: 25,
    hauptmahlzeit: 75,
  },
}

// Ältere, in Supabase gespeicherte Budget-Einstellungen können noch die
// frühere Drei-Kategorien-Aufteilung ("mittagessen"/"abendessen") enthalten.
// Ohne diese Normalisierung würde eine bereits gespeicherte Aufteilung nach
// dem Update plötzlich keine (oder eine unvollständige) Hauptmahlzeit-Angabe
// mehr haben. Mittag- und Abendanteil werden dafür einfach addiert.
export function normalizeBudgetSettings(
  raw: Partial<BudgetSettings> | null | undefined,
): BudgetSettings {
  if (!raw) return DEFAULT_BUDGET_SETTINGS
  const rawShare = raw.mealShare as
    | (Partial<Record<BudgetMealType, number>> & {
        mittagessen?: number
        abendessen?: number
      })
    | undefined

  const hasNewShape = rawShare?.hauptmahlzeit !== undefined
  const mealShare: Record<BudgetMealType, number> = hasNewShape
    ? {
        fruehstueck:
          rawShare?.fruehstueck ?? DEFAULT_BUDGET_SETTINGS.mealShare.fruehstueck,
        hauptmahlzeit: rawShare!.hauptmahlzeit!,
      }
    : rawShare && (rawShare.mittagessen !== undefined || rawShare.abendessen !== undefined)
      ? {
          fruehstueck:
            rawShare.fruehstueck ?? DEFAULT_BUDGET_SETTINGS.mealShare.fruehstueck,
          hauptmahlzeit: (rawShare.mittagessen ?? 0) + (rawShare.abendessen ?? 0),
        }
      : DEFAULT_BUDGET_SETTINGS.mealShare

  return {
    ...DEFAULT_BUDGET_SETTINGS,
    ...raw,
    mealShare,
  }
}
