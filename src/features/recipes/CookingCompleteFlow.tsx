import { useState } from 'react'
import type { Recipe } from './types'
import type { IngredientItem } from '../inventory/types'
import { useInventory } from '../inventory/useInventory'
import { ingredientToShoppingListInput } from './toShoppingListItem'
import { lookupBarcode, type OpenFoodFactsProduct } from '../../lib/openFoodFacts'
import BarcodeScanner from '../../components/BarcodeScanner'
import { BASE_SERVINGS } from './scaleMeasure'
import { Button, Card, Hint } from '../../components/ui'

interface ChecklistItem {
  name: string
  amount?: number
  unit?: string
  checked: boolean
}

interface ExtraIngredient {
  name: string
  amountG: number
  nutrimentsPer100g?: OpenFoodFactsProduct['nutrimentsPer100g']
}

function matchInventoryItem(
  name: string,
  unit: string | undefined,
  ingredients: IngredientItem[],
): IngredientItem | undefined {
  const lname = name.trim().toLowerCase()
  const candidates = ingredients.filter(
    (i) => i.name.trim().toLowerCase() === lname,
  )
  if (candidates.length === 0) return undefined
  if (unit) {
    const sameUnit = candidates.find(
      (i) => (i.unit ?? '').trim().toLowerCase() === unit.trim().toLowerCase(),
    )
    if (sameUnit) return sameUnit
  }
  return candidates[0]
}

interface Props {
  recipe: Recipe
  servings: number
}

// "Kochen abschließen": nach dem Kochen eines Rezepts können die
// verwendeten Zutaten (Mengen an die gewählte Personenzahl angepasst) mit
// einem Klick aus dem Inventar entfernt werden – vorher noch einzeln
// abwählbar oder in der Menge korrigierbar, falls z. B. eine Zutat gar
// nicht oder in anderer Menge verwendet wurde.
export default function CookingCompleteFlow({ recipe, servings }: Props) {
  const { ingredients, updateIngredient, removeIngredient } = useInventory()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [extras, setExtras] = useState<ExtraIngredient[]>([])
  const [scanning, setScanning] = useState(false)
  const [nutritionSummary, setNutritionSummary] = useState<{
    caloriesKcal?: number
    proteinG?: number
    carbsG?: number
    fatG?: number
  } | null>(null)

  function openChecklist() {
    setSummary(null)
    setNutritionSummary(null)
    setExtras([])
    setItems(
      recipe.ingredients.map((ing) => {
        const scaled = ingredientToShoppingListInput(ing, servings)
        return {
          name: scaled.name,
          amount: scaled.amount,
          unit: scaled.unit,
          checked: true,
        }
      }),
    )
    setOpen(true)
  }

  function updateItem(index: number, patch: Partial<ChecklistItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    )
  }

  async function handleExtraDetected(code: string) {
    setScanning(false)
    const product = await lookupBarcode(code)
    if (!product) return
    setExtras((prev) => [
      ...prev,
      {
        name: product.name,
        amountG: 100,
        nutrimentsPer100g: product.nutrimentsPer100g,
      },
    ])
  }

  function updateExtra(index: number, amountG: number) {
    setExtras((prev) =>
      prev.map((e, i) => (i === index ? { ...e, amountG } : e)),
    )
  }

  function removeExtra(index: number) {
    setExtras((prev) => prev.filter((_, i) => i !== index))
  }

  function handleConfirm() {
    let updated = 0
    let removed = 0
    let notFound = 0
    for (const item of items) {
      if (!item.checked) continue
      const match = matchInventoryItem(item.name, item.unit, ingredients)
      if (!match) {
        notFound++
        continue
      }
      const remaining = match.amount - (item.amount ?? match.amount)
      if (remaining <= 0) {
        removeIngredient(match.id)
        removed++
      } else {
        updateIngredient(match.id, { amount: Math.round(remaining * 100) / 100 })
        updated++
      }
    }
    const parts = []
    if (updated) parts.push(`${updated} Menge(n) angepasst`)
    if (removed) parts.push(`${removed} aufgebraucht`)
    if (notFound) parts.push(`${notFound} nicht im Inventar gefunden`)
    setSummary(parts.length > 0 ? parts.join(' · ') : 'Nichts zu tun.')

    // Kombinierte Nährwerte: Rezept-Nährwerte (auf Personenzahl
    // hochgerechnet) plus alle gescannten Extra-Zutaten (pro 100g auf die
    // eingegebene Menge hochgerechnet) – deckt den Wunsch "wenn ich andere
    // Zutaten verwende, möchte ich am Ende die Nährwerte für dieses Gericht
    // sehen" ab.
    const base = recipe.nutrition
    const scale = (v: number | undefined) =>
      v !== undefined ? (v * servings) / BASE_SERVINGS : 0
    let caloriesKcal = scale(base?.caloriesKcal)
    let proteinG = scale(base?.proteinG)
    let carbsG = scale(base?.carbsG)
    let fatG = scale(base?.fatG)
    for (const extra of extras) {
      const n = extra.nutrimentsPer100g
      if (!n) continue
      const factor = extra.amountG / 100
      caloriesKcal += (n.caloriesKcal ?? 0) * factor
      proteinG += (n.proteinG ?? 0) * factor
      carbsG += (n.carbsG ?? 0) * factor
      fatG += (n.fatG ?? 0) * factor
    }
    if (base || extras.some((e) => e.nutrimentsPer100g)) {
      setNutritionSummary({
        caloriesKcal: Math.round(caloriesKcal),
        proteinG: Math.round(proteinG),
        carbsG: Math.round(carbsG),
        fatG: Math.round(fatG),
      })
    }
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" size="sm" onClick={openChecklist}>
          ✅ Fertig gekocht – Zutaten abbuchen
        </Button>
        {summary && <Hint>{summary}</Hint>}
        {nutritionSummary && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Kalorien', value: nutritionSummary.caloriesKcal, unit: 'kcal' },
              { label: 'Eiweiß', value: nutritionSummary.proteinG, unit: 'g' },
              { label: 'Kohlenhydrate', value: nutritionSummary.carbsG, unit: 'g' },
              { label: 'Fett', value: nutritionSummary.fatG, unit: 'g' },
            ].map((r) => (
              <div key={r.label} className="rounded-xl bg-stone-50 px-3 py-2 text-center">
                <p className="text-base font-semibold text-stone-900">
                  {r.value}
                  <span className="ml-0.5 text-xs font-normal text-stone-500">{r.unit}</span>
                </p>
                <p className="text-xs text-stone-500">{r.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-stone-900">
        Welche Zutaten hast du verwendet?
      </h3>
      <Hint>Abwählen oder Menge anpassen, falls abweichend. Wird vom Inventar abgezogen.</Hint>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => updateItem(i, { checked: e.target.checked })}
              className="size-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="flex-1 text-stone-800">{item.name}</span>
            {item.amount !== undefined && (
              <input
                type="text"
                inputMode="decimal"
                value={item.amount}
                disabled={!item.checked}
                onChange={(e) => {
                  const v = parseFloat(e.target.value.replace(',', '.'))
                  updateItem(i, { amount: Number.isNaN(v) ? 0 : v })
                }}
                className="w-16 rounded-xl border border-stone-300 px-2 py-1 text-sm disabled:opacity-50"
              />
            )}
            {item.unit && <span className="w-10 text-xs text-stone-500">{item.unit}</span>}
          </li>
        ))}
      </ul>

      <div className="space-y-2 border-t border-stone-100 pt-3">
        <p className="text-sm font-medium text-stone-700">
          Zusätzliche Zutat verwendet (nicht im Rezept)?
        </p>
        <Hint>Scannen liefert Nährwerte für die kombinierte Nährwerttabelle am Ende.</Hint>
        {extras.map((extra, i) => (
          <div key={`${extra.name}-${i}`} className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-stone-800">{extra.name}</span>
            <input
              type="number"
              min={0}
              value={extra.amountG}
              onChange={(e) => updateExtra(i, parseInt(e.target.value, 10) || 0)}
              className="w-20 rounded-xl border border-stone-300 px-2 py-1 text-sm"
            />
            <span className="text-xs text-stone-500">g</span>
            <button
              onClick={() => removeExtra(i)}
              className="text-xs text-stone-400 hover:text-red-600"
            >
              Entfernen
            </button>
          </div>
        ))}
        {scanning ? (
          <BarcodeScanner
            onDetected={handleExtraDetected}
            onClose={() => setScanning(false)}
          />
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setScanning(true)}>
            📷 Extra-Zutat scannen
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleConfirm}>
          Aus Inventar entfernen
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </Card>
  )
}
