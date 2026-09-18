import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { getRandomRecipesForMeal } from '../recipes/mealdb'
import {
  hasSpoonacularKey,
  searchBudgetRecipes,
  SpoonacularQuotaError,
} from '../recipes/spoonacular'
import { getFullRecipeDetails, isSpoonacularId } from '../recipes/recipeSource'
import { translateRecipe } from '../recipes/translateRecipe'
import { translateText, translateMany } from '../../lib/translate'
import { translateCategory } from '../recipes/i18n/categories'
import { translateArea } from '../recipes/i18n/areas'
import { canCookWithInventory, missingEquipment } from '../recipes/equipmentMatch'
import { useRecipePreferences } from '../recipes/useRecipePreferences'
import RecipePreferencesPanel from '../recipes/RecipePreferencesPanel'
import { useInventory } from '../inventory/useInventory'
import { useAppSettings } from '../../lib/useAppSettings'
import type { Recipe } from '../recipes/types'
import type { MealType } from '../recipes/savedTypes'
import MealTypeChooser from '../recipes/MealTypeChooser'
import NutritionTable from '../recipes/NutritionTable'
import { useSavedRecipes } from '../recipes/useSavedRecipes'
import { useShoppingList } from '../shopping-list/useShoppingList'
import { recipeToShoppingListInputs } from '../recipes/toShoppingListItem'
import { BASE_SERVINGS } from '../recipes/scaleMeasure'
import { Button, Card, Hint } from '../../components/ui'

interface CardDisplay {
  displayName: string
  displayCategory: string
  displayArea: string
  ingredientNames: string[]
}

// "Rezepte-Tinder": zeigt Vorschläge (bevorzugt von Spoonacular, damit
// Zeit/Kosten/Geräte-Angaben vorhanden sind; ohne API-Key Fallback auf
// zufällige TheMealDB-Rezepte ohne diese Zusatzinfos), die verworfen oder
// gespeichert werden können. Gespeicherte Rezepte landen unter
// "Rezepte → Meine Rezepte".
export default function RecipeSwiper() {
  const { saveRecipe, isSaved } = useSavedRecipes()
  const { preferences } = useRecipePreferences()
  const { ownedEquipmentNames } = useInventory()
  const { appSettings } = useAppSettings()
  const shoppingList = useShoppingList()
  const [pickingMealType, setPickingMealType] = useState(false)

  const [queue, setQueue] = useState<Recipe[]>([])
  const [index, setIndex] = useState(0)
  // Nur für diese Sitzung gemerkt (kein localStorage) – verworfene Rezepte
  // sollen nicht für immer verschwinden, sondern nur nicht sofort wieder
  // auftauchen. Ein Reload oder Klick auf "Zurücksetzen" macht sie wieder
  // sichtbar.
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  const [cardDisplay, setCardDisplay] = useState<CardDisplay | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingToList, setAddingToList] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Swipe-Geste: "dragX" folgt live dem Finger/der Maus, "exiting" spielt
  // die Ausflug-Animation ab, bevor tatsächlich verworfen/gespeichert wird
  // (echtes "Tinder"-Gefühl statt reiner Klick-Buttons).
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [exiting, setExiting] = useState<'left' | 'right' | null>(null)
  const dragStartX = useRef(0)
  const SWIPE_THRESHOLD = 100

  const usingSpoonacular = hasSpoonacularKey()

  // Holt Vorschläge bevorzugt von Spoonacular (Zeit/Kosten/Geräte-/
  // Nährwert-Angaben). TheMealDB dient nur noch als echte Ausweich-Quelle,
  // wenn Spoonacular gar nichts liefert (Kontingent aufgebraucht) – vorher
  // wurden bewusst immer ein paar TheMealDB-Rezepte zur Abwechslung
  // dazugemischt, aber TheMealDB liefert grundsätzlich keine Nährwertdaten.
  // Nutzerwunsch: eine Nährwerttabelle bei jedem Gericht – das ist mit
  // durchgehend gemischten Karten ohne Nährwerte nicht zu erfüllen.
  async function fetchQueue(excludeIds: Set<string>) {
    setLoading(true)
    setError(null)
    setCardDisplay(null)
    try {
      let recipes: Recipe[] = []

      if (usingSpoonacular) {
        try {
          const results = await searchBudgetRecipes({
            maxReadyTimeMinutes: preferences.maxTimeMinutes ?? undefined,
            maxPricePerServingEuro: preferences.maxPriceEuro ?? undefined,
            excludeExoticIngredients: preferences.everydayIngredientsOnly,
            minCalories: preferences.fillingOnly ? 500 : undefined,
            // Größere Menge pro Anfrage statt öfter kleine Mengen nachzuladen
            // – spart Tageskontingent und liefert mehr Abwechslung aus einem
            // einzigen Aufruf, bevor überhaupt erneut nachgefragt wird.
            number: 15,
            sort: 'random',
            // Nur hier true: die Tinder-Karte zeigt die Nährwerttabelle
            // direkt, ohne weiteren Rezept-Detail-Aufruf.
            includeNutrition: true,
          })
          recipes = results.map((r) => r.recipe)
        } catch (err) {
          if (!(err instanceof SpoonacularQuotaError)) throw err
          // Kontingent (und Zwischenspeicher) komplett aufgebraucht – unten
          // wird stattdessen vollständig über TheMealDB aufgefüllt.
        }

        if (recipes.length === 0) {
          try {
            const extra = await getRandomRecipesForMeal(null, 8, excludeIds)
            recipes = [...recipes, ...extra]
          } catch {
            // Zweite Quelle ist nur eine Ausweichmöglichkeit – bei Fehler
            // einfach mit dem weitermachen, was schon da ist.
          }
        }

        if (preferences.respectInventory) {
          recipes = recipes.filter((r) =>
            canCookWithInventory(
              r.requiredEquipment ?? [],
              ownedEquipmentNames,
            ),
          )
        }
        recipes = recipes.filter((r) => !excludeIds.has(r.id))
      } else {
        recipes = await getRandomRecipesForMeal(null, 8, excludeIds)
      }

      if (recipes.length === 0) {
        setQueue([])
        setError(
          'Keine passenden Rezepte gefunden. Versuche es mit weniger strengen Einstellungen oder deaktiviere den Utensilien-Filter.',
        )
        return
      }
      setQueue(recipes)
      setIndex(0)
    } catch {
      setError('Vorschlag konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  // Neu laden, wenn sich die Einstellungen oder das Inventar ändern.
  useEffect(() => {
    fetchQueue(seenIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preferences.maxTimeMinutes,
    preferences.maxPriceEuro,
    preferences.everydayIngredientsOnly,
    preferences.fillingOnly,
    preferences.respectInventory,
    ownedEquipmentNames.join(','),
    usingSpoonacular,
  ])

  const current = queue[index] ?? null

  // Übersetzung nur für die aktuell sichtbare Karte (spart Übersetzungs-
  // Kontingent) – vollständige Übersetzung passiert erst beim Speichern.
  useEffect(() => {
    if (!current) {
      setCardDisplay(null)
      return
    }
    let cancelled = false
    async function run() {
      if (!current) return
      const [displayName, displayCategory, displayArea, ingredientNames] =
        await Promise.all([
          translateText(current.name),
          translateCategory(current.category),
          translateArea(current.area),
          translateMany(current.ingredients.map((i) => i.name)),
        ])
      if (!cancelled) {
        setCardDisplay({ displayName, displayCategory, displayArea, ingredientNames })
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [current])

  const missing = useMemo(() => {
    if (!current) return []
    return missingEquipment(current.requiredEquipment ?? [], ownedEquipmentNames)
  }, [current, ownedEquipmentNames])

  function advance(dismissedId?: string) {
    const nextSeen = dismissedId
      ? new Set(seenIds).add(dismissedId)
      : seenIds
    if (dismissedId) setSeenIds(nextSeen)

    if (index + 1 < queue.length) {
      setIndex(index + 1)
    } else {
      fetchQueue(nextSeen)
    }
  }

  function handleDiscard() {
    if (!current) return
    advance(current.id)
  }

  async function handleSave(mealType: MealType) {
    if (!current) return
    setSaving(true)
    setError(null)
    try {
      // Wie bei der Budget-Suche: complexSearch-Ergebnisse (dieser Vorschlag
      // kommt von searchBudgetRecipes) haben nicht immer vollständige
      // Zutatenlisten – vor dem Speichern die vollständigen Details holen
      // (und dauerhaft cachen), damit gespeicherte Rezepte nie mit leerer
      // Zutatenliste landen. Bei TheMealDB-Rezepten (id ohne "sp-"-Präfix)
      // ist "current" bereits vollständig, siehe getFullRecipeDetails.
      let complete: Recipe
      try {
        complete = await getFullRecipeDetails(current.id, current)
      } catch {
        // Nachladen fehlgeschlagen (z. B. Spoonacular-Tageskontingent gerade
        // aufgebraucht) – lieber mit den schon vorhandenen, ggf. etwas
        // unvollständigen Daten der Karte speichern, als das Speichern
        // komplett abzubrechen ("Rezept konnte nicht gespeichert werden",
        // obwohl eigentlich schon genug Daten für eine Karte da waren).
        complete = current
      }
      const full = await translateRecipe(complete)
      saveRecipe(full, {
        prepTimeMinutes: complete.prepTimeMinutes ?? current.prepTimeMinutes,
        estimatedCostEuro: complete.estimatedCostEuro ?? current.estimatedCostEuro,
        mealType,
      })
      advance(current.id)
    } catch {
      setError('Rezept konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  // Spielt die Ausflug-Animation in die jeweilige Richtung ab und ruft erst
  // danach die eigentliche Verwerfen/Speichern-Logik auf, damit der Wechsel
  // zur nächsten Karte nicht mitten in der Animation "reinspringt".
  function commitSwipe(direction: 'left' | 'right', mealType: MealType = 'sonstiges') {
    if (exiting || saving || !current) return
    setDragging(false)
    setExiting(direction)
    setTimeout(() => {
      if (direction === 'right') {
        handleSave(mealType)
      } else {
        handleDiscard()
      }
      setExiting(null)
      setDragX(0)
    }, 220)
  }

  // Speichern (per Herz-Button oder Wisch-Geste nach rechts) fragt zuerst
  // nach der Mahlzeit, falls die Einstellung das vorsieht – erst danach
  // läuft die Ausflug-Animation samt tatsächlichem Speichern.
  function requestSave() {
    if (exiting || saving || !current) return
    if (appSettings.askMealTypeOnSave) {
      setDragging(false)
      setDragX(0)
      setPickingMealType(true)
    } else {
      commitSwipe('right', 'sonstiges')
    }
  }

  function handleMealTypePicked(mealType: MealType) {
    setPickingMealType(false)
    commitSwipe('right', mealType)
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (exiting || saving) return
    dragStartX.current = e.clientX
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    setDragX(e.clientX - dragStartX.current)
  }

  function handlePointerUp() {
    if (!dragging) return
    setDragging(false)
    if (dragX > SWIPE_THRESHOLD) {
      requestSave()
    } else if (dragX < -SWIPE_THRESHOLD) {
      commitSwipe('left')
    } else {
      setDragX(0)
    }
  }

  function handleResetDismissed() {
    setSeenIds(new Set())
    fetchQueue(new Set())
  }

  // Direkt aus dem Tinder-Vorschlag heraus die Zutaten (mit automatisch
  // ermittelten Supermarkt-Preisen, siehe useShoppingList) zur Einkaufsliste
  // hinzufügen – ohne Umweg über "Speichern" + Rezeptdetails.
  async function handleAddToShoppingList() {
    if (!current) return
    setAddingToList(true)
    try {
      const complete = await getFullRecipeDetails(current.id, current)
      const full = await translateRecipe(complete)
      await shoppingList.addMany(
        recipeToShoppingListInputs(full, BASE_SERVINGS),
      )
      setJustAddedId(current.id)
      setTimeout(() => setJustAddedId(null), 2500)
    } catch {
      setError('Zutaten konnten nicht zur Einkaufsliste hinzugefügt werden.')
    } finally {
      setAddingToList(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
          Rezepte entdecken
        </h2>
        <RecipePreferencesPanel showInventoryToggleInline />
      </div>
      {!usingSpoonacular && (
        <Hint>
          Zeit/Kosten/Geräte-Filter brauchen einen Spoonacular-Key in{' '}
          <code>.env.local</code>.
        </Hint>
      )}
      {loading && <p className="text-sm text-stone-500 dark:text-stone-400">Lade Vorschlag …</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && current && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            transform: `translateX(${
              exiting === 'left' ? -480 : exiting === 'right' ? 480 : dragX
            }px) rotate(${
              exiting
                ? exiting === 'left'
                  ? -18
                  : 18
                : dragX / 16
            }deg)`,
            opacity: exiting ? 0 : 1,
            transition: dragging
              ? 'none'
              : 'transform 220ms ease-out, opacity 220ms ease-out',
            touchAction: 'pan-y',
          }}
          className="cursor-grab select-none active:cursor-grabbing"
        >
          <Card padded={false} className="overflow-hidden">
            <div className="relative">
              {current.thumbnail && (
                <img
                  src={
                    isSpoonacularId(current.id)
                      ? current.thumbnail
                      : `${current.thumbnail}/medium`
                  }
                  alt={cardDisplay?.displayName ?? current.name}
                  draggable={false}
                  className="h-56 w-full object-cover"
                />
              )}

              {/* Kosten/Zeit schweben als Badges direkt über dem Bild statt
                  als zusätzliche Textzeile darunter – kompakter und moderner. */}
              {(current.prepTimeMinutes !== undefined ||
                current.estimatedCostEuro !== undefined) && (
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  {current.prepTimeMinutes !== undefined && (
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-stone-800 shadow-sm backdrop-blur">
                      ⏱ {current.prepTimeMinutes} Min.
                    </span>
                  )}
                  {current.estimatedCostEuro !== undefined && (
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-stone-800 shadow-sm backdrop-blur">
                      💶 ca. {current.estimatedCostEuro.toFixed(2)} € / 4 Port.
                    </span>
                  )}
                </div>
              )}

              {/* Richtungs-Hinweis während des Ziehens, wie bei echten
                  Swipe-Karten. */}
              <div
                className="pointer-events-none absolute right-3 top-3 rounded-lg border-2 border-emerald-500 px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-emerald-500"
                style={{ opacity: Math.min(Math.max(dragX / 90, 0), 1) }}
              >
                Speichern
              </div>
              <div
                className="pointer-events-none absolute left-3 top-3 rounded-lg border-2 border-red-500 px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-red-500"
                style={{ opacity: Math.min(Math.max(-dragX / 90, 0), 1) }}
              >
                Nope
              </div>
            </div>

            <div className="space-y-2 p-4">
              <p className="font-medium text-stone-900 dark:text-stone-100">
                {cardDisplay?.displayName ?? current.name}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {[cardDisplay?.displayCategory, cardDisplay?.displayArea]
                  .filter(Boolean)
                  .join(' · ')}
              </p>

              {current.requiredEquipment &&
                current.requiredEquipment.length > 0 && (
                  <p className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-medium">Utensilien/Geräte: </span>
                    {current.requiredEquipment.map((eq, i) => {
                      const isMissing = missing.some(
                        (m) => m.label === eq.label,
                      )
                      return (
                        <span
                          key={eq.label}
                          className={isMissing ? 'font-medium text-red-600 dark:text-red-400' : ''}
                        >
                          {eq.label}
                          {i < current.requiredEquipment!.length - 1 ? ', ' : ''}
                        </span>
                      )
                    })}
                    {missing.length > 0 && (
                      <span className="block text-red-600 dark:text-red-400">
                        Fehlt laut deinem Inventar – trag es unter
                        „Utensilien &amp; Zutaten" ein, falls vorhanden.
                      </span>
                    )}
                  </p>
                )}

              {cardDisplay && cardDisplay.ingredientNames.length > 0 && (
                <p className="text-xs text-stone-700 dark:text-stone-300">
                  <span className="font-medium">Zutaten: </span>
                  {cardDisplay.ingredientNames.join(', ')}
                </p>
              )}

              {current.nutrition ? (
                <NutritionTable
                  nutrition={current.nutrition}
                  servings={BASE_SERVINGS}
                />
              ) : (
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  Keine Nährwertdaten für dieses Rezept verfügbar.
                </p>
              )}
            </div>

            <div className="border-t border-stone-100 dark:border-stone-800 p-3 pb-0">
              <Button
                variant="outline"
                fullWidth
                onClick={handleAddToShoppingList}
                disabled={addingToList}
              >
                {addingToList
                  ? 'Füge hinzu …'
                  : justAddedId === current.id
                    ? '✓ Zur Einkaufsliste hinzugefügt'
                    : '🛒 Zutaten zur Einkaufsliste'}
              </Button>
            </div>

            {/* Runde Icon-Buttons statt rechteckiger Vollbreiten-Buttons –
                näher am bekannten Tinder-Gefühl, zusätzlich zur echten
                Wisch-Geste auf der Karte selbst. */}
            <div className="flex items-center justify-center gap-6 p-4">
              <button
                type="button"
                onClick={() => commitSwipe('left')}
                disabled={saving}
                aria-label="Verwerfen"
                className="flex size-14 items-center justify-center rounded-full border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-2xl text-red-500 shadow-sm transition-all duration-150 hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-90 disabled:opacity-50"
              >
                ✕
              </button>
              <button
                type="button"
                onClick={requestSave}
                disabled={saving || isSaved(current.id)}
                aria-label="Speichern"
                className="flex size-16 items-center justify-center rounded-full bg-emerald-700 text-2xl text-white shadow-md shadow-emerald-950/25 transition-all duration-150 hover:bg-emerald-800 active:scale-90 disabled:opacity-50"
              >
                {isSaved(current.id) ? '✓' : saving ? '…' : '❤'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {pickingMealType && (
        <MealTypeChooser
          onPick={handleMealTypePicked}
          onCancel={() => setPickingMealType(false)}
        />
      )}

      <Hint>
        Verworfen ist nicht endgültig.{' '}
        <button
          onClick={handleResetDismissed}
          className="text-emerald-700 dark:text-emerald-400 underline"
        >
          Jetzt zurücksetzen
        </button>
      </Hint>
    </div>
  )
}
