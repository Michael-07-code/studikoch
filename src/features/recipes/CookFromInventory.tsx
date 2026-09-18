import { useState } from 'react'
import {
  findRecipesByIngredients,
  getLastFetchSource,
  getRecipeInformation,
  hasSpoonacularKey,
  SpoonacularQuotaError,
  type IngredientMatchRecipe,
} from './spoonacular'
import { translateRecipe } from './translateRecipe'
import { translateMany, translateText } from '../../lib/translate'
import { recipeToShoppingListInputs } from './toShoppingListItem'
import { useSavedRecipes } from './useSavedRecipes'
import { useShoppingList } from '../shopping-list/useShoppingList'
import { useInventory } from '../inventory/useInventory'
import RecipeDetail from './RecipeDetail'
import type { Recipe } from './types'
import { BASE_SERVINGS } from './scaleMeasure'
import { Badge, Button, Card, EmptyState, Hint } from '../../components/ui'

interface DisplayInfo {
  name: string
  usedTranslated: string[]
  missedTranslated: string[]
}

// "Was kann ich kochen?": nutzt die im Inventar hinterlegten Zutaten direkt
// (kein manuelles Eintippen wie im "Nach Zutat"-Reiter) und lässt
// Spoonacular danach ranken, welche Rezepte davon am meisten verwenden.
// Zeigt zu jedem Vorschlag, was noch fehlt.
export default function CookFromInventory() {
  const { ingredients } = useInventory()
  const savedRecipes = useSavedRecipes()
  const shoppingList = useShoppingList()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<IngredientMatchRecipe[]>([])
  const [displayInfo, setDisplayInfo] = useState<Record<string, DisplayInfo>>(
    {},
  )
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [servings, setServings] = useState(BASE_SERVINGS)
  const [hasSearched, setHasSearched] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  const ingredientNames = ingredients.map((i) => i.name)

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

  async function handleSearch() {
    setLoading(true)
    setError(null)
    setSelected(null)
    setHasSearched(true)
    try {
      const results = await findRecipesByIngredients(ingredientNames, 9)
      setFromCache(getLastFetchSource() === 'query-cache')
      setMatches(results)
      if (results.length === 0) {
        setError('Keine passenden Rezepte gefunden.')
      }
      const pairs = await Promise.all(
        results.map(async (r) => {
          const [name, used, missed] = await Promise.all([
            translateText(r.name),
            translateMany(r.usedIngredients),
            translateMany(r.missedIngredients),
          ])
          return [
            r.id,
            { name, usedTranslated: used, missedTranslated: missed },
          ] as const
        }),
      )
      setDisplayInfo(Object.fromEntries(pairs))
    } catch (err) {
      if (err instanceof SpoonacularQuotaError) {
        setError(
          'Spoonacular-Kontingent für heute aufgebraucht. Versuche es morgen wieder.',
        )
      } else {
        setError('Die Suche ist fehlgeschlagen. Prüfe deine Internetverbindung.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(match: IngredientMatchRecipe) {
    setDetailLoading(true)
    setError(null)
    setServings(BASE_SERVINGS)
    try {
      const raw = await getRecipeInformation(match.id)
      setSelected(await translateRecipe(raw))
    } catch (err) {
      if (err instanceof SpoonacularQuotaError) {
        setError(
          'Rezeptdetails konnten nicht geladen werden – Kontingent aufgebraucht.',
        )
      } else {
        setError('Rezeptdetails konnten nicht geladen werden.')
      }
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={handleSearch} disabled={loading || ingredients.length === 0}>
          {loading ? 'Suche …' : 'Rezepte aus meinem Inventar'}
        </Button>
        <Hint>{ingredients.length} Zutat(en) im Inventar hinterlegt.</Hint>
      </div>

      {ingredients.length === 0 && (
        <EmptyState>
          Noch keine Zutaten im Inventar. Trage sie unter „Inventar" ein.
        </EmptyState>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {fromCache && !error && (
        <Hint>📦 Zwischengespeichertes Ergebnis (spart Tageskontingent).</Hint>
      )}
      {detailLoading && <p className="text-sm text-stone-500 dark:text-stone-400">Lade Rezeptdetails …</p>}

      {selected && !detailLoading && (
        <RecipeDetail
          recipe={selected}
          servings={servings}
          onServingsChange={setServings}
          onClose={() => setSelected(null)}
          onAddToShoppingList={() =>
            shoppingList.addMany(
              recipeToShoppingListInputs(selected, servings),
            )
          }
          onSave={(mealType) => savedRecipes.saveRecipe(selected, { mealType })}
          isSaved={savedRecipes.isSaved(selected.id)}
        />
      )}

      {!selected && !loading && hasSearched && matches.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {matches.map((m) => {
            const info = displayInfo[m.id]
            return (
              <button
                key={m.id}
                onClick={() => handleSelect(m)}
                className="flex gap-3 overflow-hidden rounded-2xl border border-stone-200/70 dark:border-stone-700/70 bg-white dark:bg-stone-900 p-3 text-left shadow-card transition-shadow hover:shadow-card-hover"
              >
                {m.thumbnail && (
                  <img
                    src={m.thumbnail}
                    alt={info?.name ?? m.name}
                    className="h-20 w-20 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                    {info?.name ?? m.name}
                  </p>
                  {info && info.usedTranslated.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {info.usedTranslated.map((name) => (
                        <Badge key={name} tone="brand">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {info && info.missedTranslated.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Fehlt: {info.missedTranslated.join(', ')}
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
