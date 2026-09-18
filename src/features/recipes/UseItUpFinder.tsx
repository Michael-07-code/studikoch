import { useState } from 'react'
import {
  findRecipesByIngredients,
  getLastFetchSource,
  getRecipeInformation,
  hasSpoonacularKey,
  SpoonacularQuotaError,
} from './spoonacular'
import { findRecipesByIngredientsFallback, getRecipeById } from './mealdb'
import { isSpoonacularId } from './recipeSource'
import { translateRecipe } from './translateRecipe'
import { translateText, translateMany } from '../../lib/translate'
import { recipeToShoppingListInputs } from './toShoppingListItem'
import { useSavedRecipes } from './useSavedRecipes'
import { useShoppingList } from '../shopping-list/useShoppingList'
import { useInventory } from '../inventory/useInventory'
import RecipeDetail from './RecipeDetail'
import type { IngredientMatchRecipe, Recipe } from './types'
import { BASE_SERVINGS } from './scaleMeasure'
import { Badge, Button, Card, EmptyState, Hint } from '../../components/ui'

interface DisplayInfo {
  name: string
  usedTranslated: string[]
  missedTranslated: string[]
}

const RESULT_COUNT = 8

// "Was muss weg?": der Nutzer wählt aus, welche Zutaten bald ablaufen bzw.
// aufgebraucht werden sollen, und bekommt mehrere Rezeptvorschläge
// (Nutzerwunsch: mehrere Auswahlmöglichkeiten statt nur eines einzelnen
// Vorschlags) zum Durchstöbern, die möglichst viele davon verwerten.
// Nutzt Spoonacular, fällt bei aufgebrauchtem Tageskontingent automatisch
// auf die kostenlose TheMealDB-Ausweichquelle zurück (vorher gab es dort
// gar keinen Ersatz – die Suche schlug in dem Fall komplett fehl).
export default function UseItUpFinder() {
  const { ingredients } = useInventory()
  const savedRecipes = useSavedRecipes()
  const shoppingList = useShoppingList()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customInput, setCustomInput] = useState('')
  const [customNames, setCustomNames] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<IngredientMatchRecipe[]>([])
  const [displayInfo, setDisplayInfo] = useState<Record<string, DisplayInfo>>(
    {},
  )
  const [fromCache, setFromCache] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [servings, setServings] = useState(BASE_SERVINGS)

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

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function addCustom() {
    const trimmed = customInput.trim()
    if (!trimmed) return
    setCustomNames((prev) => [...prev, trimmed])
    setSelected((prev) => new Set(prev).add(trimmed))
    setCustomInput('')
  }

  async function describeMatches(results: IngredientMatchRecipe[]) {
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
  }

  async function handleSearch() {
    const names = Array.from(selected)
    if (names.length === 0) return
    setLoading(true)
    setError(null)
    setRecipe(null)
    setUsingFallback(false)
    try {
      let results: IngredientMatchRecipe[]
      try {
        results = await findRecipesByIngredients(names, RESULT_COUNT, 1)
        setFromCache(getLastFetchSource() === 'query-cache')
      } catch (err) {
        if (!(err instanceof SpoonacularQuotaError)) throw err
        // Kontingent aufgebraucht: über die kostenlose TheMealDB-
        // Ausweichquelle weitersuchen, statt die Suche ganz scheitern zu
        // lassen.
        setUsingFallback(true)
        setFromCache(false)
        results = await findRecipesByIngredientsFallback(names, RESULT_COUNT)
      }
      setMatches(results)
      if (results.length === 0) {
        setError(
          'Kein passendes Rezept gefunden. Versuche es mit weniger oder anderen Zutaten.',
        )
      }
      await describeMatches(results)
    } catch {
      setError('Die Suche ist fehlgeschlagen. Prüfe deine Internetverbindung.')
    } finally {
      setLoading(false)
    }
  }

  async function handleViewRecipe(match: IngredientMatchRecipe) {
    setRecipeLoading(true)
    setError(null)
    setServings(BASE_SERVINGS)
    try {
      const raw = isSpoonacularId(match.id)
        ? await getRecipeInformation(match.id)
        : await getRecipeById(match.id)
      if (!raw) throw new Error('Rezept nicht gefunden.')
      setRecipe(await translateRecipe(raw))
    } catch (err) {
      if (err instanceof SpoonacularQuotaError) {
        setError('Rezeptdetails konnten nicht geladen werden – Kontingent aufgebraucht.')
      } else {
        setError('Rezeptdetails konnten nicht geladen werden.')
      }
    } finally {
      setRecipeLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Hint>
        Wähle, was bald weg muss – du bekommst mehrere Rezeptvorschläge, die
        das möglichst gut verwerten.
      </Hint>

      {ingredients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ingredients.map((ing) => (
            <button
              key={ing.id}
              onClick={() => toggle(ing.name)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selected.has(ing.name)
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400 dark:ring-amber-600'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              {ing.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {customNames.map((name) => (
          <button
            key={name}
            onClick={() => toggle(name)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selected.has(name)
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400 dark:ring-amber-600'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustom()
            }
          }}
          placeholder="Weitere Zutat (nicht im Inventar)"
          className="min-w-[10rem] flex-1 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          Hinzufügen
        </Button>
      </div>

      <Button onClick={handleSearch} disabled={loading || selected.size === 0}>
        {loading ? 'Suche …' : `Rezeptvorschläge (${selected.size} Zutat(en))`}
      </Button>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {fromCache && !error && (
        <Hint>📦 Zwischengespeichertes Ergebnis (spart Tageskontingent).</Hint>
      )}
      {usingFallback && !error && (
        <Hint>
          📦 Spoonacular-Kontingent aufgebraucht – diese Vorschläge stammen
          aus einer zweiten, kostenlosen Rezeptquelle ohne Preis-/
          Zeitangabe.
        </Hint>
      )}
      {recipeLoading && <p className="text-sm text-stone-500 dark:text-stone-400">Lade Rezeptdetails …</p>}

      {recipe && !recipeLoading && (
        <RecipeDetail
          recipe={recipe}
          servings={servings}
          onServingsChange={setServings}
          onClose={() => setRecipe(null)}
          onAddToShoppingList={() =>
            shoppingList.addMany(recipeToShoppingListInputs(recipe, servings))
          }
          onSave={(mealType) => savedRecipes.saveRecipe(recipe, { mealType })}
          isSaved={savedRecipes.isSaved(recipe.id)}
        />
      )}

      {!recipe && !recipeLoading && !loading && matches.length === 0 && !error && (
        <EmptyState>
          Zutaten oben auswählen und auf „Rezeptvorschläge" klicken.
        </EmptyState>
      )}

      {!recipe && !recipeLoading && !loading && matches.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {matches.map((match) => {
            const info = displayInfo[match.id]
            return (
              <button
                key={match.id}
                onClick={() => handleViewRecipe(match)}
                className="flex gap-3 overflow-hidden rounded-2xl border border-stone-200/70 dark:border-stone-700/70 bg-white dark:bg-stone-900 p-3 text-left shadow-card transition-shadow hover:shadow-card-hover"
              >
                {match.thumbnail && (
                  <img
                    src={
                      isSpoonacularId(match.id)
                        ? match.thumbnail
                        : `${match.thumbnail}/medium`
                    }
                    alt={info?.name ?? match.name}
                    className="h-20 w-20 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                    {info?.name ?? match.name}
                  </p>
                  {info && info.usedTranslated.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {info.usedTranslated.map((name) => (
                        <Badge key={name} tone="brand">
                          ✓ {name}
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
