import type { Recipe, RecipeIngredient } from './types'
import { parseLeadingNumber, BASE_SERVINGS } from './scaleMeasure'
import { translateUnit } from './i18n/units'
import type { ShoppingListItem } from '../shopping-list/types'

/**
 * Wandelt eine Rezept-Zutat (samt Mengenangabe) in einen Einkaufslisten-
 * Eintrag um – inklusive Hochrechnung auf die gewählte Personenzahl und
 * Übersetzung der Einheit.
 */
export function ingredientToShoppingListInput(
  ingredient: RecipeIngredient,
  servings: number,
): Omit<ShoppingListItem, 'id' | 'checked'> {
  const parsed = parseLeadingNumber(ingredient.measure)

  if (!parsed) {
    const unit = translateUnit(ingredient.measure).trim()
    return {
      name: ingredient.name,
      unit: unit || undefined,
      supermarketId: null,
    }
  }

  const scaled = (parsed.value * servings) / BASE_SERVINGS
  const amount = Math.round(scaled * 100) / 100
  const unit = translateUnit(parsed.rest).trim()

  return {
    name: ingredient.name,
    amount,
    unit: unit || undefined,
    supermarketId: null,
  }
}

export function recipeToShoppingListInputs(
  recipe: Recipe,
  servings: number,
): Omit<ShoppingListItem, 'id' | 'checked'>[] {
  return recipe.ingredients.map((ing) =>
    ingredientToShoppingListInput(ing, servings),
  )
}
