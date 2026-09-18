import { useState } from 'react'
import type { MealType, RecipeList, SavedRecipe } from './savedTypes'
import RecipeDetail from './RecipeDetail'
import { BASE_SERVINGS } from './scaleMeasure'
import { Card, Hint } from '../../components/ui'

const MEAL_TYPES: MealType[] = ['fruehstueck', 'hauptmahlzeit', 'sonstiges']

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  fruehstueck: 'Frühstück',
  hauptmahlzeit: 'Mittag-/Abendessen',
  sonstiges: 'Sonstiges',
}

interface Props {
  saved: SavedRecipe
  lists: RecipeList[]
  onUpdate: (patch: Partial<Omit<SavedRecipe, 'recipe' | 'savedAt'>>) => void
  onRemove: () => void
  onAddToShoppingList: (servings: number) => void
  onClose: () => void
}

export default function SavedRecipeEditor({
  saved,
  lists,
  onUpdate,
  onRemove,
  onAddToShoppingList,
  onClose,
}: Props) {
  const [servings, setServings] = useState(BASE_SERVINGS)

  return (
    <div className="space-y-4">
      <RecipeDetail
        recipe={saved.recipe}
        servings={servings}
        onServingsChange={setServings}
        onClose={onClose}
        onAddToShoppingList={() => onAddToShoppingList(servings)}
      />

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Meine Angaben
        </h3>
        <Hint>Zeit/Kosten selbst eintragen für Budget-Vorschläge.</Hint>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col text-sm text-stone-700 dark:text-stone-300">
            Mahlzeit
            <select
              value={saved.mealType}
              onChange={(e) =>
                onUpdate({ mealType: e.target.value as MealType })
              }
              className="mt-1 rounded-xl border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-sm"
            >
              {MEAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEAL_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm text-stone-700 dark:text-stone-300">
            Zubereitungszeit (Min.)
            <input
              type="number"
              min={0}
              value={saved.prepTimeMinutes ?? ''}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                onUpdate({
                  prepTimeMinutes: Number.isNaN(v) ? undefined : v,
                })
              }}
              className="mt-1 w-24 rounded-xl border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-sm"
            />
          </label>

          <label className="flex flex-col text-sm text-stone-700 dark:text-stone-300">
            Kosten gesamt (€)
            <input
              type="text"
              inputMode="decimal"
              defaultValue={saved.estimatedCostEuro ?? ''}
              onBlur={(e) => {
                const v = parseFloat(e.target.value.replace(',', '.'))
                onUpdate({
                  estimatedCostEuro: Number.isNaN(v) ? undefined : v,
                })
              }}
              className="mt-1 w-28 rounded-xl border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        {lists.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-stone-700 dark:text-stone-300">Listen</p>
            <div className="flex flex-wrap gap-3">
              {lists.map((l) => {
                const checked = saved.listIds.includes(l.id)
                return (
                  <label
                    key={l.id}
                    className="flex items-center gap-1.5 text-sm text-stone-700 dark:text-stone-300"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onUpdate({
                          listIds: checked
                            ? saved.listIds.filter((id) => id !== l.id)
                            : [...saved.listIds, l.id],
                        })
                      }
                      className="size-4 rounded border-stone-200 dark:border-stone-700 text-emerald-600 focus:ring-emerald-500"
                    />
                    {l.name}
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <button
          onClick={onRemove}
          className="text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          Aus gespeicherten Rezepten entfernen
        </button>
      </Card>
    </div>
  )
}
