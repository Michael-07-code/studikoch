import type { Recipe } from './types'
import { translateMany, translateText } from '../../lib/translate'
import { translateCategory } from './i18n/categories'
import { translateArea } from './i18n/areas'

/**
 * Übersetzt ein vollständiges (englisches) Rezept ins Deutsche: Name,
 * Kategorie, Küche, Zubereitungsschritte und Zutatennamen. Die Mengen
 * (measure) bleiben unverändert – deren Einheit wird erst beim Anzeigen
 * zusammen mit der Personenanzahl übersetzt (siehe scaleMeasure + i18n/units).
 */
export async function translateRecipe(recipe: Recipe): Promise<Recipe> {
  const [name, category, area, instructions, ingredientNames] =
    await Promise.all([
      translateText(recipe.name),
      translateCategory(recipe.category),
      translateArea(recipe.area),
      translateMany(recipe.instructions),
      translateMany(recipe.ingredients.map((i) => i.name)),
    ])

  return {
    ...recipe,
    name,
    category,
    area,
    instructions,
    ingredients: recipe.ingredients.map((ing, idx) => ({
      name: ingredientNames[idx],
      measure: ing.measure,
    })),
  }
}
