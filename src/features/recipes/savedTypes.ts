import type { Recipe } from './types'

// Nutzerwunsch: nur noch zwei Kategorien statt drei – Mittag- und
// Abendessen wurden zu einer einzigen Kategorie "Hauptmahlzeit"
// zusammengelegt (man kocht ein Gericht und isst es mittags oder abends,
// ohne dass die App das unterscheidet).
export type MealType = 'fruehstueck' | 'hauptmahlzeit' | 'sonstiges'

// Bereits gespeicherte Rezepte können noch die frühere Drei-Kategorien-
// Unterscheidung ("mittagessen"/"abendessen") in der Datenbank stehen haben.
// Damit dafür keine Datenbank-Migration nötig ist, wird beim Lesen immer
// über diese Funktion normalisiert – alte wie neue Werte landen einheitlich
// bei der aktuellen Kategorie.
export function normalizeMealType(value: string | null | undefined): MealType {
  if (value === 'fruehstueck') return 'fruehstueck'
  if (
    value === 'hauptmahlzeit' ||
    value === 'mittagessen' ||
    value === 'abendessen'
  ) {
    return 'hauptmahlzeit'
  }
  return 'sonstiges'
}

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
