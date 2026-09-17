import { useUserSettings } from '../../lib/useUserSettings'

// Eine einzige, gemeinsame Einstellung für "wie soll für mich gekocht
// werden" – wird sowohl vom Rezepte-Tinder (Startseite) als auch von der
// Budget-Suche verwendet, damit man es nur an einer Stelle festlegen muss.
// Liegt in Supabase (user_settings.recipe_preferences), damit sie auf
// allen Geräten gleich ist.
export interface RecipePreferences {
  maxTimeMinutes: number | null
  maxPriceEuro: number | null
  everydayIngredientsOnly: boolean
  fillingOnly: boolean
  // Wenn aktiv: nur Rezepte vorschlagen/anzeigen, die sich mit den unter
  // "Utensilien & Zutaten" eingetragenen Utensilien/Öfen kochen lassen
  // (siehe equipmentMatch.ts). Betrifft nur Rezepte mit Geräte-Angaben
  // (aktuell nur Spoonacular-Rezepte, nicht TheMealDB).
  respectInventory: boolean
}

export const DEFAULT_RECIPE_PREFERENCES: RecipePreferences = {
  maxTimeMinutes: 20,
  maxPriceEuro: 2,
  everydayIngredientsOnly: true,
  fillingOnly: false,
  respectInventory: false,
}

export function useRecipePreferences() {
  const { settings, patch, loading } = useUserSettings()

  const preferences: RecipePreferences = {
    ...DEFAULT_RECIPE_PREFERENCES,
    ...((settings?.recipe_preferences as Partial<RecipePreferences> | null) ??
      {}),
  }

  function updatePreferences(p: Partial<RecipePreferences>) {
    patch({ recipe_preferences: { ...preferences, ...p } })
  }

  return { preferences, updatePreferences, loading }
}
