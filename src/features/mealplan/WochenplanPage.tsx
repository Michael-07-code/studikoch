import { useState } from 'react'
import { useWeeklyPlan } from './useWeeklyPlan'
import { useBudgetSettings } from '../budget/useBudgetSettings'
import BudgetPanel from '../budget/BudgetPage'
import { useShoppingList } from '../shopping-list/useShoppingList'
import {
  getLastFetchSource,
  hasSpoonacularKey,
  searchBudgetRecipes,
  SpoonacularQuotaError,
  type BudgetRecipeSuggestion,
} from '../recipes/spoonacular'
import { getRandomRecipesForMeal } from '../recipes/mealdb'
import { getFullRecipeDetails } from '../recipes/recipeSource'
import { translateRecipe } from '../recipes/translateRecipe'
import { translateText } from '../../lib/translate'
import { recipeToShoppingListInputs } from '../recipes/toShoppingListItem'
import { useSavedRecipes } from '../recipes/useSavedRecipes'
import { useRecipePreferences } from '../recipes/useRecipePreferences'
import RecipePreferencesPanel from '../recipes/RecipePreferencesPanel'
import RecipeDetail from '../recipes/RecipeDetail'
import type { Recipe } from '../recipes/types'
import {
  isFilledSlot,
  PLAN_DAYS,
  PLAN_SLOT_LABELS,
  PLAN_SLOT_TO_BUDGET_MEAL,
  PLAN_SLOT_TYPES,
  slotKey,
  type BudgetMealType,
  type PlanSlotType,
  type WeeklyPlanSlot,
} from './types'
import {
  Button,
  Card,
  EmptyState,
  Hint,
  PageHeader,
  TabBar,
} from '../../components/ui'

type Tab = 'plan' | 'budget'

const BUDGET_MEAL_TYPES: BudgetMealType[] = ['fruehstueck', 'hauptmahlzeit']

// Spoonacular-Gerichtart je Mahlzeit, für passendere Vorschläge als eine
// generische Suche (siehe dishType in spoonacular.ts).
const DISH_TYPE_BY_MEAL: Record<BudgetMealType, string> = {
  fruehstueck: 'breakfast',
  hauptmahlzeit: 'main course',
}

// Welche Plan-Slots (siehe types.ts) mit welcher Budget-Kategorie befüllt
// werden – Frühstück bleibt 1:1, Mittag- und Abendessen teilen sich einen
// gemeinsamen Suchtopf ("Hauptmahlzeit"), bekommen aber trotzdem je einen
// eigenen, unabhängigen Vorschlag (siehe handleGenerate).
const SLOTS_BY_BUDGET_MEAL: Record<BudgetMealType, PlanSlotType[]> = {
  fruehstueck: ['fruehstueck'],
  hauptmahlzeit: ['mittagessen', 'abendessen'],
}

// TheMealDB-Rezepte (siehe unten, Ersatzquelle bei aufgebrauchtem
// Spoonacular-Kontingent) haben keine Zeit-/Kostenangabe – die restliche
// Logik (toSlot, Kostensumme, Anzeige) behandelt "null" hier genauso wie
// Spoonacular es für unbekannte Werte auch tun würde.
function toFallbackSuggestions(recipes: Recipe[]): BudgetRecipeSuggestion[] {
  return recipes.map((recipe) => ({
    recipe,
    prepTimeMinutes: recipe.prepTimeMinutes ?? null,
    estimatedCostEuro: recipe.estimatedCostEuro ?? null,
  }))
}

function toSlot(
  suggestion: BudgetRecipeSuggestion,
  displayName: string,
): WeeklyPlanSlot {
  return {
    recipeId: suggestion.recipe.id,
    recipeName: displayName,
    recipeThumbnail: suggestion.recipe.thumbnail,
    estimatedCostEuro: suggestion.estimatedCostEuro ?? undefined,
    prepTimeMinutes: suggestion.prepTimeMinutes ?? undefined,
  }
}

// Wochenplan: pro Tag drei Mahlzeiten (Frühstück, Mittag-, Abendessen),
// passend zum Tages-/Wochenbudget (Reiter "Budget") und optional als
// "Meal-Prep" (wenige Gerichte über die Woche wiederholen statt für jeden
// Tag neu zu suchen). Mittag- und Abendessen teilen sich zwar einen
// gemeinsamen Budget-/Such-Topf ("Hauptmahlzeit", siehe budget/types.ts),
// bekommen im Plan aber trotzdem je einen eigenen Rezeptvorschlag – man isst
// schließlich real dreimal am Tag. Einzelne Tage/Mahlzeiten sind über
// "Tauschen" austauschbar, ohne den ganzen Plan neu zu erstellen.
export default function WochenplanPage() {
  const { plan, setSlot, setManySlots, toggleSkip, clearPlan, updatePlan } =
    useWeeklyPlan()
  const { settings: budgetSettings, updateSettings: updateBudgetSettings } =
    useBudgetSettings()
  const shoppingList = useShoppingList()
  const savedRecipes = useSavedRecipes()
  const { preferences } = useRecipePreferences()

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  const [candidatesByMeal, setCandidatesByMeal] = useState<
    Record<BudgetMealType, BudgetRecipeSuggestion[]>
  >({ fruehstueck: [], hauptmahlzeit: [] })
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({})

  const [viewing, setViewing] = useState<Recipe | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewServings, setViewServings] = useState(1)

  const [addingToList, setAddingToList] = useState(false)
  const [listStatus, setListStatus] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('plan')

  const dailyBase =
    budgetSettings.weeklyBudget !== undefined
      ? budgetSettings.weeklyBudget / 7
      : budgetSettings.dailyBudget

  async function handleGenerate() {
    if (dailyBase === undefined) {
      setError('Bitte zuerst ein Tages- oder Wochenbudget im Reiter „Budget" eintragen.')
      return
    }
    setGenerating(true)
    setError(null)
    setUsingFallback(false)
    try {
      const nextCandidates: Record<BudgetMealType, BudgetRecipeSuggestion[]> = {
        fruehstueck: [],
        hauptmahlzeit: [],
      }
      const nextNames: Record<string, string> = {}
      const newSlots: Record<string, WeeklyPlanSlot | null> = {}

      for (const budgetMealType of BUDGET_MEAL_TYPES) {
        const planSlots = SLOTS_BY_BUDGET_MEAL[budgetMealType]
        // Pro Tag werden so viele Plan-Slots aus diesem Topf befüllt wie
        // Mahlzeiten darauf entfallen (1 für Frühstück, 2 für Mittag- +
        // Abendessen zusammen) – das Budget pro Gericht wird entsprechend
        // aufgeteilt, sonst wäre ein einzelnes Hauptmahlzeit-Gericht auf
        // einmal für den kompletten Mittag+Abend-Anteil budgetiert.
        const mealBudget =
          (dailyBase * budgetSettings.mealShare[budgetMealType]) /
          100 /
          planSlots.length
        const wanted = plan.mealPrepMode
          ? planSlots.length + 1
          : 7 * planSlots.length
        let results: BudgetRecipeSuggestion[]
        try {
          results = await searchBudgetRecipes({
            maxPricePerServingEuro: mealBudget > 0 ? mealBudget : undefined,
            dishType: DISH_TYPE_BY_MEAL[budgetMealType],
            number: wanted,
            // Dieselben "einfach/studententauglich"-Filter wie im
            // Rezepte-Tinder und der Budget-Suche (vorher fehlten sie hier
            // komplett). "sort: random" sorgt außerdem dafür, dass "Plan
            // neu erstellen" tatsächlich neue statt der immer gleichen,
            // 24h zwischengespeicherten Vorschläge liefert. Keine Nährwerte
            // anfordern (includeNutrition weggelassen) – die werden hier nur
            // nach Klick auf "Ansehen" gebraucht (spart Tageskontingent).
            maxReadyTimeMinutes: preferences.maxTimeMinutes ?? undefined,
            excludeExoticIngredients: preferences.everydayIngredientsOnly,
            minCalories: preferences.fillingOnly ? 500 : undefined,
            sort: 'random',
          })
          if (getLastFetchSource() === 'pool-fallback') setUsingFallback(true)
        } catch (err) {
          if (!(err instanceof SpoonacularQuotaError)) throw err
          // Kontingent (und Zwischenspeicher) aufgebraucht: für diese
          // Mahlzeit stattdessen über die kostenlose zweite Quelle
          // (TheMealDB) auffüllen, statt den ganzen Plan scheitern zu
          // lassen. Ohne Preis-/Zeitangabe, siehe toFallbackSuggestions.
          setUsingFallback(true)
          const fallbackRecipes = await getRandomRecipesForMeal(
            budgetMealType,
            wanted,
          )
          results = toFallbackSuggestions(fallbackRecipes)
        }
        nextCandidates[budgetMealType] = results

        const pairs = await Promise.all(
          results.map(
            async (r) => [r.recipe.id, await translateText(r.recipe.name)] as const,
          ),
        )
        for (const [id, name] of pairs) nextNames[id] = name

        if (results.length === 0) continue
        const distinctCount = plan.mealPrepMode
          ? Math.min(planSlots.length + 1, results.length)
          : results.length
        // Ein fortlaufender Zähler über Tag×Slot statt getrennt pro Slot-Typ
        // zu indizieren, damit Mittag- und Abendessen (beide aus demselben
        // "results"-Topf) nach Möglichkeit unterschiedliche Gerichte
        // bekommen, statt an jedem Tag identisch zu sein.
        let cursor = 0
        for (let day = 0; day < 7; day++) {
          for (const slotType of planSlots) {
            const candidate = results[cursor % Math.max(distinctCount, 1)]
            cursor++
            newSlots[slotKey(day, slotType)] = candidate
              ? toSlot(candidate, nextNames[candidate.recipe.id] ?? candidate.recipe.name)
              : null
          }
        }
      }

      setCandidatesByMeal(nextCandidates)
      setDisplayNames((prev) => ({ ...prev, ...nextNames }))
      setManySlots(newSlots)
    } catch (err) {
      if (err instanceof SpoonacularQuotaError) {
        setError(
          'Spoonacular-Kontingent für heute aufgebraucht. Versuche es morgen wieder.',
        )
      } else {
        setError('Plan konnte nicht erstellt werden. Prüfe deine Internetverbindung.')
      }
    } finally {
      setGenerating(false)
    }
  }

  function handleSwap(day: number, slotType: PlanSlotType) {
    const budgetMealType = PLAN_SLOT_TO_BUDGET_MEAL[slotType]
    const candidates = candidatesByMeal[budgetMealType]
    if (candidates.length === 0) return
    const current = plan.slots[slotKey(day, slotType)]
    const currentIdx = candidates.findIndex(
      (c) => isFilledSlot(current) && c.recipe.id === current.recipeId,
    )
    const next = candidates[(currentIdx + 1) % candidates.length]
    setSlot(
      slotKey(day, slotType),
      toSlot(next, displayNames[next.recipe.id] ?? next.recipe.name),
    )
  }

  async function handleView(slot: WeeklyPlanSlot & { recipeId: string }) {
    setViewLoading(true)
    setError(null)
    setViewServings(1)
    try {
      let raw: Recipe
      try {
        raw = await getFullRecipeDetails(slot.recipeId)
      } catch {
        // Nachladen fehlgeschlagen (z. B. Spoonacular-Kontingent gerade
        // aufgebraucht) – der letzte "Plan erstellen"/"Tauschen"-Aufruf hat
        // bereits ein vollständiges Rezeptobjekt für diesen Vorschlag
        // geladen (siehe candidatesByMeal); das notfalls stattdessen
        // anzeigen, statt "Rezeptdetails konnten nicht geladen werden" zu
        // melden, obwohl die Daten eigentlich schon da wären.
        const allCandidates = [
          ...candidatesByMeal.fruehstueck,
          ...candidatesByMeal.hauptmahlzeit,
        ]
        const cached = allCandidates.find(
          (c) => c.recipe.id === slot.recipeId,
        )?.recipe
        if (!cached) throw new Error('Rezept nicht gefunden.')
        raw = cached
      }
      setViewing(await translateRecipe(raw))
    } catch {
      setError('Rezeptdetails konnten nicht geladen werden.')
    } finally {
      setViewLoading(false)
    }
  }

  async function handleAddWeekToShoppingList() {
    setAddingToList(true)
    setListStatus(null)
    try {
      const distinctIds = Array.from(
        new Set(
          Object.values(plan.slots)
            .filter(isFilledSlot)
            .map((s) => s.recipeId),
        ),
      )
      const recipes = await Promise.all(
        distinctIds.map((id) => getFullRecipeDetails(id)),
      )
      const allInputs = recipes.flatMap((r) => recipeToShoppingListInputs(r, 1))
      await shoppingList.addMany(allInputs)
      setListStatus(
        `Zutaten von ${distinctIds.length} Rezept(en) zur Einkaufsliste hinzugefügt.`,
      )
    } catch {
      setListStatus('Einige Zutaten konnten nicht hinzugefügt werden.')
    } finally {
      setAddingToList(false)
    }
  }

  const filledSlotCount = Object.values(plan.slots).filter(Boolean).length
  // Grobe Näherung: estimatedCostEuro gilt für 4 Portionen, ein Slot steht
  // für eine Mahlzeit (1 Portion). Übersprungene Mahlzeiten ("ich esse hier
  // nichts") fließen bewusst nicht in die Kostensumme ein.
  const totalCost = Object.values(plan.slots).reduce(
    (sum, s) => (isFilledSlot(s) ? sum + (s.estimatedCostEuro ?? 0) / 4 : sum),
    0,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wochenplan"
        description="Ein Rezeptvorschlag pro Mahlzeit und Tag, passend zu deinem Budget – einzelne Tage austauschbar."
        icon="🗓️"
        tone="violet"
      />

      <TabBar
        tabs={[
          { id: 'plan', label: 'Plan' },
          { id: 'budget', label: 'Budget' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {tab === 'plan' && !hasSpoonacularKey() && (
        <Card className="text-sm text-stone-700 dark:text-stone-300">
          Der Wochenplan braucht einen Spoonacular-API-Key. Kostenlos
          erstellen auf{' '}
          <a
            href="https://spoonacular.com/food-api"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 dark:text-emerald-400 underline"
          >
            spoonacular.com/food-api
          </a>
          , dann als <code>VITE_SPOONACULAR_API_KEY</code> in{' '}
          <code>.env.local</code> eintragen.
        </Card>
      )}

      {tab === 'plan' && hasSpoonacularKey() && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleGenerate} disabled={generating}>
                {generating
                  ? 'Erstelle Plan …'
                  : filledSlotCount > 0
                    ? 'Plan neu erstellen'
                    : 'Plan erstellen'}
              </Button>
              <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={plan.mealPrepMode}
                  onChange={(e) => updatePlan({ mealPrepMode: e.target.checked })}
                  className="size-4 rounded border-stone-200 dark:border-stone-700 text-emerald-600 focus:ring-emerald-500"
                />
                Meal-Prep (wenige Gerichte wiederholen)
              </label>
              {filledSlotCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearPlan}>
                  Plan leeren
                </Button>
              )}
            </div>
            <RecipePreferencesPanel />
          </div>

          {dailyBase === undefined && (
            <Hint>
              Tages- oder Wochenbudget im Reiter „Budget" eintragen, um einen
              Plan zu erstellen.
            </Hint>
          )}
          {usingFallback && (
            <Hint>
              📦 Spoonacular-Kontingent aufgebraucht – einzelne Vorschläge
              stammen aus einer zweiten Rezeptquelle ohne Preis-/Zeitangabe.
            </Hint>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {filledSlotCount > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Hint>Geschätzte Kosten der Woche: ca. {totalCost.toFixed(2)} €</Hint>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddWeekToShoppingList}
                disabled={addingToList}
              >
                {addingToList ? 'Füge hinzu …' : '🛒 Zutaten der Woche zur Einkaufsliste'}
              </Button>
            </div>
          )}
          {listStatus && <Hint>{listStatus}</Hint>}

          {viewLoading && <p className="text-sm text-stone-500 dark:text-stone-400">Lade Rezeptdetails …</p>}
          {viewing && !viewLoading && (
            <RecipeDetail
              recipe={viewing}
              servings={viewServings}
              onServingsChange={setViewServings}
              onClose={() => setViewing(null)}
              onAddToShoppingList={() =>
                shoppingList.addMany(recipeToShoppingListInputs(viewing, viewServings))
              }
              onSave={(mealType) => savedRecipes.saveRecipe(viewing, { mealType })}
              isSaved={savedRecipes.isSaved(viewing.id)}
            />
          )}

          {!viewing && filledSlotCount === 0 && !generating && (
            <EmptyState>
              Noch kein Plan erstellt – oben auf „Plan erstellen" klicken.
            </EmptyState>
          )}

          {!viewing && filledSlotCount > 0 && (
            <div className="space-y-3">
              {PLAN_DAYS.map((dayLabel, day) => (
                <Card key={dayLabel} className="space-y-2">
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{dayLabel}</h3>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PLAN_SLOT_TYPES.map((slotType) => {
                      const key = slotKey(day, slotType)
                      const slot = plan.slots[key]
                      return (
                        <div key={slotType} className="rounded-xl bg-stone-100 dark:bg-stone-800 p-2 text-xs">
                          <p className="mb-1 font-medium text-stone-500 dark:text-stone-400">
                            {PLAN_SLOT_LABELS[slotType]}
                          </p>
                          {isFilledSlot(slot) ? (
                            <div className="space-y-1">
                              <p className="text-sm text-stone-900 dark:text-stone-100">{slot.recipeName}</p>
                              <p className="text-stone-500 dark:text-stone-400">
                                {[
                                  slot.prepTimeMinutes ? `${slot.prepTimeMinutes} Min.` : null,
                                  slot.estimatedCostEuro !== undefined
                                    ? `${(slot.estimatedCostEuro / 4).toFixed(2)} €`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                              <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                  onClick={() => handleView(slot)}
                                  className="text-emerald-700 dark:text-emerald-400 underline"
                                >
                                  Ansehen
                                </button>
                                <button
                                  onClick={() => handleSwap(day, slotType)}
                                  className="text-stone-500 dark:text-stone-400 underline"
                                >
                                  Tauschen
                                </button>
                                <button
                                  onClick={() => toggleSkip(key)}
                                  className="text-stone-500 dark:text-stone-400 underline"
                                >
                                  Nichts essen
                                </button>
                              </div>
                            </div>
                          ) : slot?.skipped ? (
                            <div className="space-y-1">
                              <p className="italic text-stone-400 dark:text-stone-500">
                                Nichts geplant
                              </p>
                              <button
                                onClick={() => toggleSkip(key)}
                                className="text-emerald-700 dark:text-emerald-400 underline"
                              >
                                Doch etwas essen
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-stone-400 dark:text-stone-500">–</p>
                              <button
                                onClick={() => toggleSkip(key)}
                                className="text-stone-500 dark:text-stone-400 underline"
                              >
                                Nichts essen
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'budget' && (
        <BudgetPanel
          settings={budgetSettings}
          updateSettings={updateBudgetSettings}
        />
      )}
    </div>
  )
}
