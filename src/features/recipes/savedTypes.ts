import type { Recipe } from './types'

export type MealType =
  | 'fruehstueck'
  | 'mittagessen'
  | 'abendessen'
  | 'sonstiges'

export interface RecipeList {
  id: string
  name: string
}

export interface SavedRecipe {
  // Vollständiges, bereits ins Deutsche übersetztes Rezept – so lässt es
  // sich später ohne erneute API-Aufrufe/Übersetzung wieder anzeigen.
  recipe: Recipe
  savedAt: string
  listIds: string[]
  mealType: MealType
  // Von dir selbst eingetragen (TheMealDB liefert das nicht):
  prepTimeMinutes?: number
  estimatedCostEuro?: number
}
