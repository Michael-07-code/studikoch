import { useState } from 'react'
import SimpleItemList from '../../components/SimpleItemList'
import type { MealType, RecipeList, SavedRecipe } from './savedTypes'
import { EmptyState } from '../../components/ui'

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  fruehstueck: 'Frühstück',
  hauptmahlzeit: 'Mittag-/Abendessen',
  sonstiges: 'Sonstiges',
}

const LIST_SUGGESTIONS = [
  'Favoriten',
  'Schnelle Gerichte',
  'Zum Ausprobieren',
  'Meal Prep',
]

interface Props {
  saved: SavedRecipe[]
  lists: RecipeList[]
  onAddList: (name: string) => void
  onRemoveList: (id: string) => void
  onSelect: (recipeId: string) => void
}

export default function SavedRecipesBrowser({
  saved,
  lists,
  onAddList,
  onRemoveList,
  onSelect,
}: Props) {
  const [activeList, setActiveList] = useState<string>('all')
  const [showListManager, setShowListManager] = useState(false)

  const filtered =
    activeList === 'all'
      ? saved
      : saved.filter((s) => s.listIds.includes(activeList))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveList('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeList === 'all'
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
          }`}
        >
          Alle ({saved.length})
        </button>
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveList(l.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeList === l.id
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            {l.name} ({saved.filter((s) => s.listIds.includes(l.id)).length})
          </button>
        ))}
        <button
          onClick={() => setShowListManager((v) => !v)}
          className="text-xs text-emerald-700 dark:text-emerald-400 underline"
        >
          {showListManager ? 'Listen ausblenden' : 'Listen verwalten'}
        </button>
      </div>

      {showListManager && (
        <SimpleItemList
          title="Meine Listen"
          items={lists}
          onAdd={onAddList}
          onRemove={onRemoveList}
          suggestions={LIST_SUGGESTIONS}
          placeholder="z. B. Favoriten"
          emptyText="Noch keine Listen angelegt."
          datalistId="recipe-list-suggestions"
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState>Noch keine gespeicherten Rezepte hier.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((s) => (
            <button
              key={s.recipe.id}
              onClick={() => onSelect(s.recipe.id)}
              className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 dark:border-stone-700/70 bg-white dark:bg-stone-900 text-left shadow-card transition-shadow hover:shadow-card-hover"
            >
              {s.recipe.thumbnail && (
                <img
                  src={
                    // TheMealDB unterstützt einen "/medium"-Bildgrößen-
                    // Suffix, Spoonacular- und eigene (Supabase-Storage-)
                    // Bild-URLs dagegen nicht – vorher wurde das immer
                    // angehängt, wodurch z. B. Spoonacular-Vorschaubilder
                    // hier kaputt waren (404).
                    s.recipe.thumbnail.includes('themealdb.com')
                      ? `${s.recipe.thumbnail}/medium`
                      : s.recipe.thumbnail
                  }
                  alt={s.recipe.name}
                  className="h-32 w-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="p-3">
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  {s.recipe.name}
                </p>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {[
                    MEAL_TYPE_LABELS[s.mealType],
                    s.prepTimeMinutes ? `${s.prepTimeMinutes} Min.` : null,
                    s.estimatedCostEuro !== undefined
                      ? `${s.estimatedCostEuro.toFixed(2)} €`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
