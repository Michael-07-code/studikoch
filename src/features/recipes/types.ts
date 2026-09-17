import type { RequiredEquipment } from './equipmentMatch'

export interface RecipeSummary {
  id: string
  name: string
  thumbnail: string
}

export interface RecipeIngredient {
  name: string
  measure: string
}

// Werte bezogen auf BASE_SERVINGS (4) Portionen, analog zu
// estimatedCostEuro – zum Anzeigen mit der Personenzahl hochrechnen.
export interface RecipeNutrition {
  caloriesKcal?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
}

export interface Recipe extends RecipeSummary {
  category: string
  area: string
  // Bereits in einzelne Zubereitungsschritte aufgeteilt (siehe mealdb.ts).
  instructions: string[]
  ingredients: RecipeIngredient[]
  sourceUrl?: string
  // Nur von Spoonacular geliefert (TheMealDB hat diese Daten nicht):
  prepTimeMinutes?: number
  // Geschätzte Gesamtkosten des Rezepts bei BASE_SERVINGS (4) Portionen.
  estimatedCostEuro?: number
  requiredEquipment?: RequiredEquipment[]
  // Nur von Spoonacular geliefert.
  nutrition?: RecipeNutrition
}
