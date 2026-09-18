import { getRecipeById as getMealDbRecipeById } from './mealdb'
import { getRecipeInformation as getSpoonacularRecipeInformation } from './spoonacular'
import type { Recipe } from './types'

// Spoonacular-IDs bekommen beim Import bewusst das Präfix "sp-" (siehe
// spoonacular.ts toRecipe), damit sie nicht mit TheMealDB-IDs kollidieren.
// Daran lässt sich pro Rezept erkennen, von welcher Quelle es stammt – z. B.
// wenn Rezepte-Tinder oder Wochenplan beide Quellen mischen.
export function isSpoonacularId(id: string): boolean {
  return id.startsWith('sp-')
}

/**
 * Lädt die vollständigen Details eines Rezepts unabhängig davon, ob es von
 * Spoonacular oder TheMealDB stammt. TheMealDB liefert bei jeder Anfrage
 * (auch der Zufalls-/Kategoriesuche) bereits alle Zutaten und
 * Zubereitungsschritte in einem Aufruf – anders als Spoonacular, wo die
 * Suche (complexSearch) oft unvollständige Daten liefert und ein separater
 * "/information"-Aufruf nötig ist (siehe getRecipeInformation). "fallback"
 * kann daher für TheMealDB-Rezepte direkt das schon vorhandene Objekt sein
 * (z. B. das Rezept aus der Tinder-Warteschlange) – dann entfällt sogar der
 * zusätzliche Lookup komplett.
 */
export async function getFullRecipeDetails(
  id: string,
  fallback?: Recipe,
): Promise<Recipe> {
  if (isSpoonacularId(id)) {
    return getSpoonacularRecipeInformation(id)
  }
  if (fallback) return fallback
  const recipe = await getMealDbRecipeById(id)
  if (!recipe) {
    throw new Error('Rezept nicht gefunden.')
  }
  return recipe
}
