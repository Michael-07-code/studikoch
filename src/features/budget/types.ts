export type BudgetMealType = 'fruehstueck' | 'mittagessen' | 'abendessen'

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
    fruehstueck: 20,
    mittagessen: 40,
    abendessen: 40,
  },
}
