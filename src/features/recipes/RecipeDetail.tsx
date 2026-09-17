import { useEffect, useMemo, useRef, useState } from 'react'
import type { Recipe } from './types'
import type { MealType } from './savedTypes'
import { BASE_SERVINGS, scaleMeasure } from './scaleMeasure'
import { translateUnit } from './i18n/units'
import { missingEquipment } from './equipmentMatch'
import { useInventory } from '../inventory/useInventory'
import { useAppSettings } from '../../lib/useAppSettings'
import CookingCompleteFlow from './CookingCompleteFlow'
import MealTypeChooser from './MealTypeChooser'
import NutritionTable from './NutritionTable'
import { Badge, Button, Card, Hint } from '../../components/ui'

interface Props {
  recipe: Recipe
  servings: number
  onServingsChange: (servings: number) => void
  onClose: () => void
  // Optional: nicht jede Stelle, die RecipeDetail nutzt, bietet diese
  // Aktionen an (z. B. blendet die Speichern-Ansicht "Speichern" aus).
  onAddToShoppingList?: () => void
  // Bekommt die vom Nutzer gewählte (oder standardmäßig "sonstiges")
  // Mahlzeit übergeben – siehe MealTypeChooser/useAppSettings.
  onSave?: (mealType: MealType) => void
  isSaved?: boolean
}

export default function RecipeDetail({
  recipe,
  servings,
  onServingsChange,
  onClose,
  onAddToShoppingList,
  onSave,
  isSaved,
}: Props) {
  // Kurze Bestätigung nach "Zutaten zur Einkaufsliste hinzufügen", statt
  // stillschweigend nichts zu tun – blendet sich nach ein paar Sekunden
  // automatisch wieder aus.
  const [justAdded, setJustAdded] = useState(false)
  const [pickingMealType, setPickingMealType] = useState(false)
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { ownedEquipmentNames } = useInventory()
  const { appSettings } = useAppSettings()

  useEffect(() => {
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current)
    }
  }, [])

  const missing = useMemo(
    () => missingEquipment(recipe.requiredEquipment ?? [], ownedEquipmentNames),
    [recipe, ownedEquipmentNames],
  )

  // TheMealDB unterstützt einen "/large"-Bildgrößen-Suffix, Spoonacular-
  // Bild-URLs dagegen nicht – deshalb nur bei erkennbaren TheMealDB-URLs
  // anhängen, sonst die Original-URL unverändert verwenden.
  const imageUrl = recipe.thumbnail.includes('themealdb.com')
    ? `${recipe.thumbnail}/large`
    : recipe.thumbnail

  function handleAddToShoppingListClick() {
    if (!onAddToShoppingList) return
    onAddToShoppingList()
    setJustAdded(true)
    if (hideTimeout.current) clearTimeout(hideTimeout.current)
    hideTimeout.current = setTimeout(() => setJustAdded(false), 2500)
  }

  function handleSaveClick() {
    if (!onSave) return
    if (appSettings.askMealTypeOnSave) {
      setPickingMealType(true)
    } else {
      onSave('sonstiges')
    }
  }

  function handleMealTypePicked(mealType: MealType) {
    setPickingMealType(false)
    onSave?.(mealType)
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-100">
            {recipe.name}
          </h2>
          <p className="text-sm text-stone-400">
            {[recipe.category, recipe.area].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-xl px-2 py-1 text-sm text-stone-400 hover:bg-stone-800"
        >
          Schließen
        </button>
      </div>

      {(onAddToShoppingList || onSave) && (
        <div className="flex flex-wrap items-center gap-2">
          {onAddToShoppingList && (
            <Button size="sm" onClick={handleAddToShoppingListClick}>
              Zutaten zur Einkaufsliste
            </Button>
          )}
          {onSave && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveClick}
              disabled={isSaved || pickingMealType}
            >
              {isSaved ? 'Gespeichert ✓' : 'Rezept speichern'}
            </Button>
          )}
          {justAdded && (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-400">
              ✓ Hinzugefügt
            </span>
          )}
        </div>
      )}

      {pickingMealType && (
        <MealTypeChooser
          onPick={handleMealTypePicked}
          onCancel={() => setPickingMealType(false)}
        />
      )}

      {recipe.thumbnail && (
        <img
          src={imageUrl}
          alt={recipe.name}
          className="w-full rounded-xl object-cover sm:max-w-sm"
        />
      )}

      {(recipe.prepTimeMinutes !== undefined ||
        recipe.estimatedCostEuro !== undefined ||
        (recipe.requiredEquipment && recipe.requiredEquipment.length > 0)) && (
        <div className="space-y-1 rounded-xl bg-stone-800 p-3 text-sm text-stone-300">
          {(recipe.prepTimeMinutes !== undefined ||
            recipe.estimatedCostEuro !== undefined) && (
            <p>
              {[
                recipe.prepTimeMinutes !== undefined
                  ? `⏱ ${recipe.prepTimeMinutes} Min.`
                  : null,
                recipe.estimatedCostEuro !== undefined
                  ? `💶 ca. ${(
                      (recipe.estimatedCostEuro * servings) / BASE_SERVINGS
                    ).toFixed(2)} € für ${servings} Portion${servings === 1 ? '' : 'en'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {recipe.requiredEquipment && recipe.requiredEquipment.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.requiredEquipment.map((eq) => (
                <Badge
                  key={eq.label}
                  tone={
                    missing.some((m) => m.label === eq.label)
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  {eq.label}
                </Badge>
              ))}
            </div>
          )}
          {missing.length > 0 && (
            <p className="text-amber-400">
              Fehlt laut Inventar: {missing.map((m) => m.label).join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <label htmlFor="servings" className="text-sm font-medium text-stone-300">
          Personenanzahl
        </label>
        <input
          id="servings"
          type="number"
          min={1}
          max={20}
          value={servings}
          onChange={(e) => {
            const next = parseInt(e.target.value, 10)
            onServingsChange(Number.isNaN(next) || next < 1 ? 1 : next)
          }}
          className="w-20 rounded-xl border border-stone-700 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
      <Hint>Mengen hochgerechnet ab 4 Portionen, Text maschinell übersetzt.</Hint>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-100">Zutaten</h3>
        <ul className="space-y-1 text-sm text-stone-300">
          {recipe.ingredients.map((ing) => (
            <li key={ing.name} className="flex justify-between gap-4">
              <span>{ing.name}</span>
              <span className="text-stone-400">
                {scaleMeasure(ing.measure, servings, translateUnit)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {recipe.nutrition && (
        <NutritionTable nutrition={recipe.nutrition} servings={servings} />
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-100">
          Zubereitung
        </h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-300">
          {recipe.instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      <CookingCompleteFlow recipe={recipe} servings={servings} />

      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm text-emerald-400 underline"
        >
          Originalquelle
        </a>
      )}
    </Card>
  )
}
