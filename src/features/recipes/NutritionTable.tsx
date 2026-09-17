import type { RecipeNutrition } from './types'
import { BASE_SERVINGS } from './scaleMeasure'

interface Props {
  nutrition: RecipeNutrition
  servings: number
}

function scale(value: number | undefined, servings: number): number | undefined {
  if (value === undefined) return undefined
  return Math.round((value * servings) / BASE_SERVINGS)
}

// Nährwerttabelle pro Rezept – nur für Spoonacular-Rezepte verfügbar
// (TheMealDB liefert keine Nährwertdaten). Werte werden auf die aktuell
// gewählte Personenzahl hochgerechnet, analog zu den Zutatenmengen.
export default function NutritionTable({ nutrition, servings }: Props) {
  const rows: { label: string; value: number | undefined; unit: string }[] = [
    { label: 'Kalorien', value: scale(nutrition.caloriesKcal, servings), unit: 'kcal' },
    { label: 'Eiweiß', value: scale(nutrition.proteinG, servings), unit: 'g' },
    { label: 'Kohlenhydrate', value: scale(nutrition.carbsG, servings), unit: 'g' },
    { label: 'Fett', value: scale(nutrition.fatG, servings), unit: 'g' },
  ].filter((r) => r.value !== undefined)

  if (rows.length === 0) return null

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-stone-900">
        Nährwerte · {servings} Portion{servings === 1 ? '' : 'en'}
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-xl bg-stone-50 px-3 py-2 text-center"
          >
            <p className="text-base font-semibold text-stone-900">
              {r.value}
              <span className="ml-0.5 text-xs font-normal text-stone-500">
                {r.unit}
              </span>
            </p>
            <p className="text-xs text-stone-500">{r.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
