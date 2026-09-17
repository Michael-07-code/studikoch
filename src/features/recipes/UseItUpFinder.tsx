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
import { translateText, translateMany } from '../../lib/translate'
import { recipeToShoppingListInputs } from './toShoppingListItem'
import { useSavedRecipes } from './useSavedRecipes'
import { useShoppingList } from '../shopping-list/useShoppingList'
import { useInventory } from '../inventory/useInventory'
import RecipeDetail from './RecipeDetail'
import type { Recipe } from './types'
import { BASE_SERVINGS } from './scaleMeasure'
import { Badge, Button, Card, Hint } from '../../components/ui'

interface DisplayInfo {
  name: string
  usedTranslated: string[]
  missedTranslated: string[]
}

// "Was muss weg?": der Nutzer wählt aus, welche Zutaten bald ablaufen bzw.
// aufgebraucht werden sollen, und bekommt einen großen, prominenten
// Rezeptvorschlag, der möglichst viele davon verwertet (statt einer langen
// Ergebnisliste – genau ein Hauptvorschlag, mit ein paar Alternativen zum
// Durchblättern darunter).
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
  const [activeIndex, setActiveIndex] = useState(0)
  const [fromCache, setFromCache] = useState(false)

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [servings, setServings] = useState(BASE_SERVINGS)

  if (!hasSpoonacularKey()) {
    return (
      <Card className="text-sm text-stone-600">
        Kein Spoonacular-API-Key gefunden. Kostenlos erstellen auf{' '}
        <a
          href="https://spoonacular.com/food-api"
          target="_blank"
          rel="noreferrer"
          className="text-emerald-700 underline"
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

  async function handleSearch() {
    const names = Array.from(selected)
    if (names.length === 0) return
    setLoading(true)
    setError(null)
    setRecipe(null)
    setActiveIndex(0)
    try {
      const results = await findRecipesByIngredients(names, 5, 1)
      setFromCache(getLastFetchSource() === 'query-cache')
      setMatches(results)
      if (results.length === 0) {
        setError(
          'Kein passendes Rezept gefunden. Versuche es mit weniger oder anderen Zutaten.',
        )
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

  async function handleViewRecipe(match: IngredientMatchRecipe) {
    setRecipeLoading(true)
    setError(null)
    setServings(BASE_SERVINGS)
    try {
      const raw = await getRecipeInformation(match.id)
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

  const active = matches[activeIndex]
  const activeInfo = active ? displayInfo[active.id] : undefined

  return (
    <div className="space-y-4">
      <Hint>
        Wähle, was bald weg muss – du bekommst einen großen Rezeptvorschlag,
        der das möglichst gut verwertet.
      </Hint>

      {ingredients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ingredients.map((ing) => (
            <button
              key={ing.id}
              onClick={() => toggle(ing.name)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selected.has(ing.name)
                  ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-400'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
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
                ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-400'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
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
          className="min-w-[10rem] flex-1 rounded-xl border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          Hinzufügen
        </Button>
      </div>

      <Button onClick={handleSearch} disabled={loading || selected.size === 0}>
        {loading ? 'Suche …' : `Rezeptvorschlag (${selected.size} Zutat(en))`}
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {fromCache && !error && (
        <Hint>📦 Zwischengespeichertes Ergebnis (spart Tageskontingent).</Hint>
      )}
      {recipeLoading && <p className="text-sm text-stone-500">Lade Rezeptdetails …</p>}

      {recipe && !recipeLoading && (
        <RecipeDetail
          recipe={recipe}
          servings={servings}
          onServingsChange={setServings}
          onClose={() => setRecipe(null)}
          onAddToShoppingList={() =>
            shoppingList.addMany(recipeToShoppingListInputs(recipe, servings))
          }
          onSave={() => savedRecipes.saveRecipe(recipe)}
          isSaved={savedRecipes.isSaved(recipe.id)}
        />
      )}

      {!recipe && !recipeLoading && !loading && active && (
        <Card padded={false} className="overflow-hidden">
          {active.thumbnail && (
            <img
              src={active.thumbnail}
              alt={activeInfo?.name ?? active.name}
              className="h-48 w-full object-cover"
            />
          )}
          <div className="space-y-2 p-4">
            <p className="text-lg font-semibold text-stone-900">
              {activeInfo?.name ?? active.name}
            </p>
            {activeInfo && activeInfo.usedTranslated.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeInfo.usedTranslated.map((name) => (
                  <Badge key={name} tone="brand">
                    ✓ {name}
                  </Badge>
                ))}
              </div>
            )}
            {activeInfo && activeInfo.missedTranslated.length > 0 && (
              <p className="text-sm text-amber-700">
                Fehlt noch: {activeInfo.missedTranslated.join(', ')}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => handleViewRecipe(active)}>
                Rezept ansehen
              </Button>
              {matches.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setActiveIndex((i) => (i + 1) % matches.length)
                  }
                >
                  Anderen Vorschlag
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
