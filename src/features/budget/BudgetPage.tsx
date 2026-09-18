import { useState } from 'react'
import { useSavedRecipes } from '../recipes/useSavedRecipes'
import type { SavedRecipe } from '../recipes/savedTypes'
import type { BudgetMealType, BudgetSettings } from './types'
import { Card, EmptyState, Hint, TabBar } from '../../components/ui'

type Period = 'tag' | 'woche'

const MEAL_TYPES: BudgetMealType[] = [
  'fruehstueck',
  'mittagessen',
  'abendessen',
]

const MEAL_TYPE_LABELS: Record<BudgetMealType, string> = {
  fruehstueck: 'Frühstück',
  mittagessen: 'Mittagessen',
  abendessen: 'Abendessen',
}

function suggestionsFor(
  priced: SavedRecipe[],
  budget: number,
  mealType?: BudgetMealType,
): SavedRecipe[] {
  return priced
    .filter((s) => (mealType ? s.mealType === mealType : true))
    .filter((s) => (s.estimatedCostEuro ?? Infinity) <= budget)
    .sort((a, b) => (a.estimatedCostEuro ?? 0) - (b.estimatedCostEuro ?? 0))
    .slice(0, 6)
}

function SuggestionGrid({ items }: { items: SavedRecipe[] }) {
  if (items.length === 0) {
    return <EmptyState>Keine passenden Rezepte gefunden.</EmptyState>
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((s) => (
        <Card key={s.recipe.id} className="p-2 text-sm" padded={false}>
          <p className="font-medium text-stone-900 dark:text-stone-100">{s.recipe.name}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {s.estimatedCostEuro?.toFixed(2)} €
            {s.prepTimeMinutes ? ` · ${s.prepTimeMinutes} Min.` : ''}
          </p>
        </Card>
      ))}
    </ul>
  )
}

interface Props {
  settings: BudgetSettings
  updateSettings: (patch: Partial<BudgetSettings>) => void
}

// Lebt als interner Reiter im Wochenplan (nicht mehr als eigene
// Navigationsseite) – daher kein eigener PageHeader. "settings" kommt als
// Prop von WochenplanPage statt aus einem eigenen useBudgetSettings()-Aufruf,
// damit beide Reiter (Plan/Budget) dieselbe Einstellungs-Instanz teilen und
// eine Änderung hier sofort im Plan-Reiter (z. B. Tagesbudget) ankommt.
export default function BudgetPanel({ settings, updateSettings }: Props) {
  const [period, setPeriod] = useState<Period>('tag')
  const { saved } = useSavedRecipes()

  const priced = saved.filter((s) => s.estimatedCostEuro !== undefined)

  const dailyBase =
    period === 'tag'
      ? settings.dailyBudget
      : settings.weeklyBudget !== undefined
        ? settings.weeklyBudget / 7
        : undefined

  function updateMealShare(type: BudgetMealType, value: number) {
    updateSettings({
      mealShare: { ...settings.mealShare, [type]: value },
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Vorschläge aus deinen gespeicherten Rezepten mit Kostenangabe.
      </p>

      {priced.length === 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-sm text-amber-800 dark:text-amber-300">
          Noch keine Vorschläge möglich: Speichere Rezepte und trage dort
          unter „Meine Angaben" eine geschätzte Kostenangabe ein.
        </Card>
      )}

      <TabBar
        tabs={[
          { id: 'tag', label: 'Tagesbudget' },
          { id: 'woche', label: 'Wochenbudget' },
        ]}
        active={period}
        onChange={(id) => setPeriod(id as Period)}
      />

      <div className="flex flex-wrap items-end gap-4">
        {period === 'tag' ? (
          <label className="flex flex-col text-sm text-stone-700 dark:text-stone-300">
            Tagesbudget (€)
            <input
              type="text"
              inputMode="decimal"
              defaultValue={settings.dailyBudget ?? ''}
              onBlur={(e) => {
                const v = parseFloat(e.target.value.replace(',', '.'))
                updateSettings({
                  dailyBudget: Number.isNaN(v) ? undefined : v,
                })
              }}
              className="mt-1 w-32 rounded-xl border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-sm"
            />
          </label>
        ) : (
          <label className="flex flex-col text-sm text-stone-700 dark:text-stone-300">
            Wochenbudget (€)
            <input
              type="text"
              inputMode="decimal"
              defaultValue={settings.weeklyBudget ?? ''}
              onBlur={(e) => {
                const v = parseFloat(e.target.value.replace(',', '.'))
                updateSettings({
                  weeklyBudget: Number.isNaN(v) ? undefined : v,
                })
              }}
              className="mt-1 w-32 rounded-xl border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-sm"
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
          <input
            type="checkbox"
            checked={settings.splitByMeal}
            onChange={(e) =>
              updateSettings({ splitByMeal: e.target.checked })
            }
            className="size-4 rounded border-stone-200 dark:border-stone-700 text-emerald-600 focus:ring-emerald-500"
          />
          Nach Mahlzeit trennen
        </label>
      </div>

      {settings.splitByMeal && dailyBase !== undefined && (
        <div className="flex flex-wrap gap-4">
          {MEAL_TYPES.map((type) => (
            <label key={type} className="flex flex-col text-xs text-stone-700 dark:text-stone-300">
              {MEAL_TYPE_LABELS[type]} (% vom Tagesbudget)
              <input
                type="number"
                min={0}
                max={100}
                value={settings.mealShare[type]}
                onChange={(e) =>
                  updateMealShare(type, parseInt(e.target.value, 10) || 0)
                }
                className="mt-1 w-24 rounded-xl border border-stone-200 dark:border-stone-700 px-2 py-1"
              />
            </label>
          ))}
        </div>
      )}

      {dailyBase === undefined ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Trage oben ein Budget ein, um Vorschläge zu sehen.
        </p>
      ) : settings.splitByMeal ? (
        <div className="space-y-5">
          {MEAL_TYPES.map((type) => {
            const budget = (dailyBase * settings.mealShare[type]) / 100
            return (
              <div key={type}>
                <h3 className="mb-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {MEAL_TYPE_LABELS[type]} · Budget {budget.toFixed(2)} €
                </h3>
                <SuggestionGrid
                  items={suggestionsFor(priced, budget, type)}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
            Passende Rezepte · Budget {dailyBase.toFixed(2)} €
          </h3>
          <SuggestionGrid items={suggestionsFor(priced, dailyBase)} />
        </div>
      )}

      {period === 'woche' && (
        <Hint>Budget gleichmäßig auf 7 Tage verteilt (Wochenbudget ÷ 7).</Hint>
      )}
    </div>
  )
}
