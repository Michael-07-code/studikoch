import { translateText } from '../../../lib/translate'

// TheMealDB verwendet eine feste, kurze Liste von Kategorien – die können
// wir direkt und zuverlässig von Hand übersetzen, ohne die Übersetzungs-API
// (und ihr Tageslimit) dafür zu belasten.
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  Beef: 'Rind',
  Breakfast: 'Frühstück',
  Chicken: 'Hähnchen',
  Dessert: 'Nachtisch',
  Goat: 'Ziege',
  Lamb: 'Lamm',
  Miscellaneous: 'Verschiedenes',
  Pasta: 'Pasta',
  Pork: 'Schwein',
  Seafood: 'Meeresfrüchte',
  Side: 'Beilage',
  Starter: 'Vorspeise',
  Vegan: 'Vegan',
  Vegetarian: 'Vegetarisch',
}

export async function translateCategory(category: string): Promise<string> {
  if (!category) return category
  return CATEGORY_TRANSLATIONS[category] ?? (await translateText(category))
}
