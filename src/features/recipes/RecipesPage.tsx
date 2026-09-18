import { useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import type { Recipe, RecipeSummary } from './types'
import {
  filterRecipesByIngredient,
  getRandomRecipe,
  getRecipeById,
  searchRecipesByName,
} from './mealdb'
import { translateRecipe } from './translateRecipe'
import { translateText } from '../../lib/translate'
import { recipeToShoppingListInputs } from './toShoppingListItem'
import { useSavedRecipes } from './useSavedRecipes'
import { useShoppingList } from '../shopping-list/useShoppingList'
import RecipeCard from './RecipeCard'
import RecipeDetail from './RecipeDetail'
import SavedRecipesBrowser from './SavedRecipesBrowser'
import SavedRecipeEditor from './SavedRecipeEditor'
import BudgetSearch from './BudgetSearch'
import CookFromInventory from './CookFromInventory'
import UseItUpFinder from './UseItUpFinder'
import { BASE_SERVINGS } from './scaleMeasure'
import { Button, Hint, PageHeader, TabBar } from '../../components/ui'

type Mode = 'suche' | 'inventory' | 'useitup' | 'budget' | 'saved'
type SearchBy = 'name' | 'ingredient'

const VALID_MODES: Mode[] = ['suche', 'inventory', 'useitup', 'budget', 'saved']

export default function RecipesPage() {
  // Erlaubt Sprünge von anderen Seiten aus direkt in einen bestimmten Reiter
  // (z. B. von der Startseiten-Kachel "Was kann ich kochen?" direkt in
  // "Rezepte → Was kann ich kochen?"), statt nur auf der Übersicht zu landen.
  const location = useLocation()
  const requestedMode = (location.state as { mode?: Mode } | null)?.mode
  const [mode, setMode] = useState<Mode>(
    requestedMode && VALID_MODES.includes(requestedMode)
      ? requestedMode
      : 'suche',
  )
  const [searchBy, setSearchBy] = useState<SearchBy>('name')
  const [query, setQuery] = useState('')
  // "results" bleibt immer im englischen Originalzustand, wie von
  // TheMealDB geliefert – so kann bei Auswahl eines Rezepts sauber
  // (einmalig) übersetzt werden, ohne bereits übersetzten Text erneut
  // durch die Übersetzungs-API zu schicken.
  const [results, setResults] = useState<RecipeSummary[]>([])
  const [nameTranslations, setNameTranslations] = useState<
    Record<string, string>
  >({})
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [servings, setServings] = useState(BASE_SERVINGS)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null)

  const shoppingList = useShoppingList()
  const savedRecipes = useSavedRecipes()

  async function translateNames(items: RecipeSummary[]) {
    const pairs = await Promise.all(
      items.map(
        async (item) => [item.id, await translateText(item.name)] as const,
      ),
    )
    setNameTranslations((prev) => {
      const next = { ...prev }
      for (const [id, name] of pairs) next[id] = name
      return next
    })
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setSelected(null)
    try {
      const found =
        searchBy === 'name'
          ? await searchRecipesByName(trimmed)
          : await filterRecipesByIngredient(trimmed)
      setResults(found)
      setHasSearched(true)
      await translateNames(found)
    } catch {
      setError(
        'Die Rezeptsuche ist fehlgeschlagen. Prüfe deine Internetverbindung und versuche es erneut.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleRandom() {
    setLoading(true)
    setError(null)
    setSelected(null)
    try {
      const recipe = await getRandomRecipe()
      if (recipe) {
        setResults([recipe])
        setHasSearched(true)
        await translateNames([recipe])
      }
    } catch {
      setError('Zufälliges Rezept konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(item: RecipeSummary) {
    setError(null)
    setServings(BASE_SERVINGS)
    setDetailLoading(true)
    try {
      // Im Namens-Modus enthält "item" (aus den englischen Rohdaten in
      // "results") bereits alle Details. Im Zutaten-Modus liefert die
      // Suche nur Name/Bild/ID, die Details müssen einzeln nachgeladen
      // werden. In beiden Fällen übersetzen wir erst jetzt, einmalig.
      const raw =
        searchBy === 'name' ? (item as Recipe) : await getRecipeById(item.id)

      if (!raw) {
        setError('Rezept konnte nicht gefunden werden.')
        return
      }
      setSelected(await translateRecipe(raw))
    } catch {
      setError('Rezept konnte nicht geladen werden.')
    } finally {
      setDetailLoading(false)
    }
  }

  function handleAddSelectedToShoppingList() {
    if (!selected) return
    shoppingList.addMany(recipeToShoppingListInputs(selected, servings))
  }

  const selectedSaved = selectedSavedId
    ? (savedRecipes.saved.find((s) => s.recipe.id === selectedSavedId) ??
      null)
    : null

  const tabs = [
    { id: 'suche', label: 'Suche' },
    { id: 'inventory', label: 'Was kann ich kochen?' },
    { id: 'useitup', label: 'Was muss weg?' },
    { id: 'budget', label: 'Budget-Suche' },
    { id: 'saved', label: `Meine Rezepte (${savedRecipes.saved.length})` },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Rezepte" icon="🍳" tone="emerald" />

      <TabBar
        tabs={tabs}
        active={mode}
        onChange={(id) => {
          setMode(id as Mode)
          if (id === 'saved') setSelectedSavedId(null)
        }}
      />

      {mode === 'suche' && (
        <>
          <div className="inline-flex rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 p-1 text-sm">
            {(
              [
                { id: 'name', label: 'Nach Name' },
                { id: 'ingredient', label: 'Nach Zutat' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSearchBy(opt.id)
                  setResults([])
                  setHasSearched(false)
                  setSelected(null)
                }}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  searchBy === opt.id
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                searchBy === 'name'
                  ? 'z. B. Pasta (englisch eingeben)'
                  : 'z. B. chicken, rice'
              }
              className="min-w-[12rem] flex-1 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <Button type="submit" disabled={loading}>
              Suchen
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRandom}
              disabled={loading}
            >
              Zufälliges Rezept
            </Button>
          </form>
          <Hint>Suchbegriffe auf Englisch, Ergebnisse werden übersetzt.</Hint>
        </>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p className="text-sm text-stone-500 dark:text-stone-400">Lade Rezepte …</p>}
      {detailLoading && (
        <p className="text-sm text-stone-500 dark:text-stone-400">Lade Rezeptdetails …</p>
      )}

      {mode === 'suche' && selected && !detailLoading && (
        <RecipeDetail
          recipe={selected}
          servings={servings}
          onServingsChange={setServings}
          onClose={() => setSelected(null)}
          onAddToShoppingList={handleAddSelectedToShoppingList}
          onSave={(mealType) => savedRecipes.saveRecipe(selected, { mealType })}
          isSaved={savedRecipes.isSaved(selected.id)}
        />
      )}

      {mode === 'suche' &&
        !selected &&
        !loading &&
        hasSearched &&
        results.length === 0 && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Keine Rezepte gefunden. Versuche einen anderen (englischen)
            Begriff.
          </p>
        )}

      {mode === 'suche' && !selected && results.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {results.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              displayName={nameTranslations[recipe.id] ?? recipe.name}
              onSelect={() => handleSelect(recipe)}
            />
          ))}
        </div>
      )}

      {mode === 'inventory' && <CookFromInventory />}

      {mode === 'useitup' && <UseItUpFinder />}

      {mode === 'budget' && <BudgetSearch />}

      {mode === 'saved' && !selectedSaved && (
        <SavedRecipesBrowser
          saved={savedRecipes.saved}
          lists={savedRecipes.lists}
          onAddList={savedRecipes.addList}
          onRemoveList={savedRecipes.removeList}
          onSelect={setSelectedSavedId}
        />
      )}

      {mode === 'saved' && selectedSaved && (
        <SavedRecipeEditor
          saved={selectedSaved}
          lists={savedRecipes.lists}
          onUpdate={(patch) =>
            savedRecipes.updateSaved(selectedSaved.recipe.id, patch)
          }
          onRemove={() => {
            savedRecipes.removeSaved(selectedSaved.recipe.id)
            setSelectedSavedId(null)
          }}
          onAddToShoppingList={(servingsForRecipe) =>
            shoppingList.addMany(
              recipeToShoppingListInputs(
                selectedSaved.recipe,
                servingsForRecipe,
              ),
            )
          }
          onClose={() => setSelectedSavedId(null)}
        />
      )}
    </div>
  )
}
