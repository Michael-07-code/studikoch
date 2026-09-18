import { useState, type FormEvent } from 'react'
import type { Recipe } from './types'
import {
  getLastFetchSource,
  getRecipeInformation,
  hasSpoonacularKey,
  searchBudgetRecipes,
  SpoonacularQuotaError,
  type BudgetRecipeSuggestion,
} from './spoonacular'
import { translateRecipe } from './translateRecipe'
import { translateText } from '../../lib/translate'
import { recipeToShoppingListInputs } from './toShoppingListItem'
import { useSavedRecipes } from './useSavedRecipes'
import { useShoppingList } from '../shopping-list/useShoppingList'
import { canCookWithInventory, missingEquipment } from './equipmentMatch'
import { useRecipePreferences } from './useRecipePreferences'
import RecipePreferencesPanel from './RecipePreferencesPanel'
import { useInventory } from '../inventory/useInventory'
import RecipeDetail from './RecipeDetail'
import { BASE_SERVINGS } from './scaleMeasure'
import { Button, Card, Hint } from '../../components/ui'

interface SelectedBudgetRecipe {
  recipe: Recipe
  prepTimeMinutes: number | null
  estimatedCostEuro: number | null
}

// Rezeptsuche über Spoonacular statt TheMealDB: liefert echte
// Zubereitungszeit + Kosten pro Portion mit, gefiltert nach den
// gemeinsamen "Studentenfreundlich"-Einstellungen (siehe
// useRecipePreferences.ts, auch vom Rezepte-Tinder verwendet). Braucht
// einen (kostenlosen) Spoonacular-API-Key in .env.local.
export default function BudgetSearch() {
  const { preferences } = useRecipePreferences()
  const { ownedEquipmentNames } = useInventory()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<BudgetRecipeSuggestion[]>([])
  const [displayNames, setDisplayNames] = useState<Record<string, string>>(
    {},
  )
  const [usingFallback, setUsingFallback] = useState(false)
  const [selected, setSelected] = useState<SelectedBudgetRecipe | null>(null)
  const [servings, setServings] = useState(BASE_SERVINGS)
  const [detailLoading, setDetailLoading] = useState(false)

  const savedRecipes = useSavedRecipes()
  const shoppingList = useShoppingList()

  if (!hasSpoonacularKey()) {
    return (
      <Card className="text-sm text-stone-700 dark:text-stone-300">
        Kein Spoonacular-API-Key gefunden. Kostenlos erstellen auf{' '}
        <a
          href="https://spoonacular.com/food-api"
          target="_blank"
          rel="noreferrer"
          className="text-emerald-700 dark:text-emerald-400 underline"
        >
          spoonacular.com/food-api
        </a>
        , dann als <code>VITE_SPOONACULAR_API_KEY</code> in{' '}
        <code>.env.local</code> eintragen und neu starten.
      </Card>
    )
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSelected(null)
    setUsingFallback(false)
    try {
      const results = await searchBudgetRecipes({
        maxReadyTimeMinutes: preferences.maxTimeMinutes ?? undefined,
        maxPricePerServingEuro: preferences.maxPriceEuro ?? undefined,
        excludeExoticIngredients: preferences.everydayIngredientsOnly,
        minCalories: preferences.fillingOnly ? 500 : undefined,
        number: 10,
      })
      if (getLastFetchSource() === 'pool-fallback') setUsingFallback(true)
      const filtered = preferences.respectInventory
        ? results.filter((r) =>
            canCookWithInventory(
              r.recipe.requiredEquipment ?? [],
              ownedEquipmentNames,
            ),
          )
        : results
      setSuggestions(filtered)
      if (filtered.length === 0) {
        setError(
          'Keine passenden Rezepte gefunden. Versuche es mit weniger strengen Einstellungen oder deaktiviere den Utensilien-Filter.',
        )
      }
      const pairs = await Promise.all(
        filtered.map(
          async (s) =>
            [s.recipe.id, await translateText(s.recipe.name)] as const,
        ),
      )
      setDisplayNames(Object.fromEntries(pairs))
    } catch (err) {
      if (err instanceof SpoonacularQuotaError) {
        setError(
          'Spoonacular-Kontingent für heute aufgebraucht und keine zwischengespeicherten Rezepte passend zu diesen Filtern vorhanden. Versuche es morgen wieder oder lockere die Filter.',
        )
      } else {
        setError(
          'Die Budget-Suche ist fehlgeschlagen. Prüfe deinen API-Key und deine Internetverbindung.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(s: BudgetRecipeSuggestion) {
    setDetailLoading(true)
    setError(null)
    setServings(BASE_SERVINGS)
    try {
      // complexSearch (searchBudgetRecipes) liefert nicht immer vollständige
      // Zutatenlisten – über getRecipeInformation() holen/cachen wir die
      // vollständigen Details (siehe spoonacular.ts), statt das aus der
      // Trefferliste unvollständige Rezept direkt anzuzeigen.
      const full = await getRecipeInformation(s.recipe.id)
      const translated = await translateRecipe(full)
      setSelected({
        recipe: translated,
        prepTimeMinutes: full.prepTimeMinutes ?? s.prepTimeMinutes,
        estimatedCostEuro: full.estimatedCostEuro ?? s.estimatedCostEuro,
      })
    } catch {
      setError('Rezept konnte nicht geladen werden.')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearch}>
          <Button type="submit" disabled={loading}>
            {loading ? 'Suche …' : 'Rezepte vorschlagen'}
          </Button>
        </form>
        <RecipePreferencesPanel />
      </div>
      <Hint>Nutzt deine Einstellungen (⚙ oben) – Spoonacular-Kontingent ist begrenzt.</Hint>
      {usingFallback && (
        <Hint>📦 Kontingent aufgebraucht – zeige zwischengespeicherte Rezepte.</Hint>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p className="text-sm text-stone-500 dark:text-stone-400">Suche …</p>}
      {detailLoading && (
        <p className="text-sm text-stone-500 dark:text-stone-400">Lade Rezeptdetails …</p>
      )}

      {selected && !detailLoading && (
        <RecipeDetail
          recipe={selected.recipe}
          servings={servings}
          onServingsChange={setServings}
          onClose={() => setSelected(null)}
          onAddToShoppingList={() =>
            shoppingList.addMany(
              recipeToShoppingListInputs(selected.recipe, servings),
            )
          }
          onSave={(mealType) =>
            savedRecipes.saveRecipe(selected.recipe, {
              prepTimeMinutes: selected.prepTimeMinutes ?? undefined,
              estimatedCostEuro: selected.estimatedCostEuro ?? undefined,
              mealType,
            })
          }
          isSaved={savedRecipes.isSaved(selected.recipe.id)}
        />
      )}

      {!selected && !loading && suggestions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {suggestions.map((s) => {
            const missing = missingEquipment(
              s.recipe.requiredEquipment ?? [],
              ownedEquipmentNames,
            )
            return (
              <button
                key={s.recipe.id}
                onClick={() => handleSelect(s)}
                className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 dark:border-stone-700/70 bg-white dark:bg-stone-900 text-left shadow-card transition-shadow hover:shadow-card-hover"
              >
                {s.recipe.thumbnail && (
                  <img
                    src={s.recipe.thumbnail}
                    alt={displayNames[s.recipe.id] ?? s.recipe.name}
                    className="h-32 w-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="p-3">
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    {displayNames[s.recipe.id] ?? s.recipe.name}
                  </p>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {[
                      s.prepTimeMinutes ? `${s.prepTimeMinutes} Min.` : null,
                      s.estimatedCostEuro !== null
                        ? `${s.estimatedCostEuro.toFixed(2)} €`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {missing.length > 0 && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Fehlt: {missing.map((m) => m.label).join(', ')}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
