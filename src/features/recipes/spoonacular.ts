import type { Recipe, RecipeIngredient, RecipeNutrition } from './types'
import { extractRequiredEquipment } from './equipmentMatch'
import {
  addToPool,
  getCachedRecipeDetail,
  getFromPool,
  getIngredientQueryCache,
  getPoolRecipeById,
  getQueryCache,
  setCachedRecipeDetail,
  setIngredientQueryCache,
  setQueryCache,
} from './recipeCache'

const BASE_URL = 'https://api.spoonacular.com/recipes'

// Spoonacular liefert echte Portionsangaben, unser restliches System
// (siehe scaleMeasure.ts) rechnet aber einheitlich ausgehend von
// BASE_SERVINGS (4) Portionen. Wir normalisieren Mengen beim Import auf
// 4 Portionen um, damit die vorhandene Hochrechnungslogik (Personenzahl-
// Feld, Einkaufsliste) unverändert weiterfunktioniert.
const NORMALIZED_SERVINGS = 4

// Näherungswert für die Umrechnung, kein Live-Wechselkurs (Stand: Herbst
// 2026). Für eine grobe Kostenschätzung ausreichend.
const USD_TO_EUR_RATE = 0.87

function getApiKey(): string | null {
  const key = import.meta.env.VITE_SPOONACULAR_API_KEY as string | undefined
  return key && key.trim() ? key.trim() : null
}

export function hasSpoonacularKey(): boolean {
  return getApiKey() !== null
}

interface SpoonacularIngredient {
  name: string
  amount: number
  unit: string
}

interface SpoonacularEquipment {
  name: string
}

interface SpoonacularInstructionStep {
  number: number
  step: string
  equipment?: SpoonacularEquipment[]
}

interface SpoonacularInstructionGroup {
  name: string
  steps: SpoonacularInstructionStep[]
}

interface SpoonacularNutrient {
  name: string
  amount: number
  unit: string
}

interface SpoonacularNutrition {
  nutrients?: SpoonacularNutrient[]
}

interface SpoonacularRecipe {
  id: number
  title: string
  image: string | null
  readyInMinutes: number | null
  servings: number | null
  // In US-Cent pro Portion.
  pricePerServing: number | null
  sourceUrl: string | null
  cuisines: string[]
  dishTypes: string[]
  extendedIngredients: SpoonacularIngredient[]
  analyzedInstructions: SpoonacularInstructionGroup[]
  nutrition?: SpoonacularNutrition
}

interface ComplexSearchResponse {
  results: SpoonacularRecipe[]
}

function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return String(rounded)
}

function toIngredients(
  raw: SpoonacularIngredient[],
  actualServings: number,
): RecipeIngredient[] {
  const factor =
    actualServings > 0 ? NORMALIZED_SERVINGS / actualServings : 1
  return raw.map((ing) => ({
    name: ing.name,
    measure: `${formatAmount(ing.amount * factor)}${
      ing.unit ? ` ${ing.unit}` : ''
    }`,
  }))
}

function toInstructions(groups: SpoonacularInstructionGroup[]): string[] {
  return groups.flatMap((g) => g.steps.map((s) => s.step))
}

function toEquipmentNames(groups: SpoonacularInstructionGroup[]): string[] {
  return groups.flatMap((g) =>
    g.steps.flatMap((s) => s.equipment?.map((e) => e.name) ?? []),
  )
}

function priceToEuroPerRecipe(pricePerServingCents: number | null): number | null {
  if (pricePerServingCents === null) return null
  const usdPerServing = pricePerServingCents / 100
  const eurPerServing = usdPerServing * USD_TO_EUR_RATE
  return Math.round(eurPerServing * NORMALIZED_SERVINGS * 100) / 100
}

function euroPerRecipeToUsdCentsPerServing(euroPerRecipe: number): number {
  const eurPerServing = euroPerRecipe / NORMALIZED_SERVINGS
  const usdPerServing = eurPerServing / USD_TO_EUR_RATE
  return Math.round(usdPerServing * 100)
}

// Normalisiert Kalorien/Protein/Kohlenhydrate/Fett von der tatsächlichen
// Portionsangabe des Rezepts auf NORMALIZED_SERVINGS, analog zu den
// Zutatenmengen (toIngredients) und den Kosten (priceToEuroPerRecipe).
function extractNutrition(
  nutrition: SpoonacularNutrition | undefined,
  actualServings: number,
): RecipeNutrition | undefined {
  const nutrients = nutrition?.nutrients
  if (!nutrients || nutrients.length === 0) return undefined

  const factor = actualServings > 0 ? NORMALIZED_SERVINGS / actualServings : 1
  const findAmount = (name: string) =>
    nutrients.find((n) => n.name === name)?.amount

  const calories = findAmount('Calories')
  const protein = findAmount('Protein')
  const carbs = findAmount('Carbohydrates')
  const fat = findAmount('Fat')

  if (
    calories === undefined &&
    protein === undefined &&
    carbs === undefined &&
    fat === undefined
  ) {
    return undefined
  }

  const scale = (v: number | undefined) =>
    v !== undefined ? Math.round(v * factor * 10) / 10 : undefined

  return {
    caloriesKcal: scale(calories),
    proteinG: scale(protein),
    carbsG: scale(carbs),
    fatG: scale(fat),
  }
}

function toRecipe(raw: SpoonacularRecipe): Recipe {
  const actualServings = raw.servings ?? NORMALIZED_SERVINGS
  const instructionGroups = raw.analyzedInstructions ?? []
  return {
    // Prefix, damit es nicht mit TheMealDB-IDs (ebenfalls numerische
    // Strings) kollidiert.
    id: `sp-${raw.id}`,
    name: raw.title,
    thumbnail: raw.image ?? '',
    category: raw.dishTypes[0] ?? '',
    area: raw.cuisines[0] ?? '',
    instructions: toInstructions(instructionGroups),
    ingredients: toIngredients(raw.extendedIngredients ?? [], actualServings),
    sourceUrl: raw.sourceUrl ?? undefined,
    prepTimeMinutes: raw.readyInMinutes ?? undefined,
    estimatedCostEuro: priceToEuroPerRecipe(raw.pricePerServing) ?? undefined,
    requiredEquipment: extractRequiredEquipment(
      toEquipmentNames(instructionGroups),
    ),
    nutrition: extractNutrition(raw.nutrition, actualServings),
  }
}

export interface BudgetRecipeSuggestion {
  recipe: Recipe
  prepTimeMinutes: number | null
  // Bezogen auf das ganze Rezept bei 4 Portionen (unsere
  // Normalisierungsbasis), nicht pro Portion.
  estimatedCostEuro: number | null
}

// Zutaten, die in einem typischen (Studenten-)Haushalt bzw. im normalen
// Supermarkt selten vorhanden, teuer oder schwer zu bekommen sind. Werden
// standardmäßig ausgeschlossen, damit Vorschläge mit alltäglichen Zutaten
// kochbar bleiben, statt eine Spezialzutat für ein einziges Rezept kaufen
// zu müssen. Kein Anspruch auf Vollständigkeit – eine pragmatische
// Stichwortliste, kein Ersatz für eine echte "wie üblich ist diese Zutat"-
// Datenquelle (die es kostenlos nicht gibt).
const EXOTIC_INGREDIENTS = [
  'truffle',
  'caviar',
  'saffron',
  'foie gras',
  'venison',
  'lobster',
  'duck breast',
  'wagyu',
  'kobe beef',
  'pomegranate molasses',
  'star anise',
  'dragon fruit',
  'goji berries',
  'nori',
  'miso',
  'gochujang',
  'tamarind',
  'sumac',
  'harissa',
  'quail',
  'rabbit',
]

// Wird geworfen, wenn Spoonacular ein aufgebrauchtes Tageskontingent meldet
// (HTTP 402) oder eine Ratenbegrenzung greift (429) UND kein lokal
// zwischengespeichertes Rezept als Ersatz zur Verfügung steht. Erlaubt der
// UI eine gezielte, verständliche Fehlermeldung statt eines generischen
// "Fehler beim Laden".
export class SpoonacularQuotaError extends Error {
  constructor(
    message = 'Spoonacular-Tageskontingent aufgebraucht oder Anfragelimit erreicht.',
  ) {
    super(message)
    this.name = 'SpoonacularQuotaError'
  }
}

export type SpoonacularFetchSource = 'network' | 'query-cache' | 'pool-fallback'

let lastFetchSource: SpoonacularFetchSource = 'network'

// Nach jedem searchBudgetRecipes()-Aufruf auslesbar: woher die Ergebnisse
// kamen. Die UI kann damit z. B. anzeigen, dass gerade zwischengespeicherte
// statt frisch geladene Rezepte angezeigt werden.
export function getLastFetchSource(): SpoonacularFetchSource {
  return lastFetchSource
}

export interface BudgetSearchParams {
  maxReadyTimeMinutes?: number
  maxPricePerServingEuro?: number
  query?: string
  number?: number
  // "Studentenfreundlich"-Filter, standardmäßig an, einzeln abschaltbar:
  excludeExoticIngredients?: boolean
  // Mindest-Kalorien pro Portion, um eher sättigende statt kalorienarme
  // Gerichte vorzuschlagen (z. B. 500).
  minCalories?: number
  // 'price' (günstigste zuerst, Budget-Suche) oder 'random' (Rezepte-
  // Tinder auf der Startseite).
  sort?: 'price' | 'random'
  // Spoonacular-Gerichtart, z. B. 'breakfast' oder 'main course' – nutzt
  // der Wochenplan, um pro Mahlzeitentyp passendere Vorschläge zu bekommen.
  dishType?: string
}

/**
 * Sucht Rezepte über Spoonacular, gefiltert nach maximaler Zubereitungszeit
 * und/oder maximalen Kosten pro Portion. Liefert direkt verwertbare Zeit-
 * und Kostenangaben mit – im Gegensatz zu TheMealDB, das diese Daten nicht
 * hat.
 */
export async function searchBudgetRecipes(
  params: BudgetSearchParams,
): Promise<BudgetRecipeSuggestion[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Kein Spoonacular-API-Key konfiguriert.')
  }

  // Anfrage-Cache: identische Suche innerhalb der letzten 24h spart einen
  // erneuten (kontingentierten) API-Aufruf komplett. Gilt nicht für
  // sort: 'random' (Rezepte-Tinder) – dort soll jeder Aufruf möglichst neue
  // Vorschläge liefern, sonst würden nach ein paar Wischbewegungen immer
  // dieselben (dann bereits "gesehenen") 10 Rezepte zurückkommen.
  const useQueryCache = params.sort !== 'random'
  if (useQueryCache) {
    const cached = getQueryCache(params as Record<string, unknown>)
    if (cached) {
      lastFetchSource = 'query-cache'
      return cached
    }
  }

  const url = new URL(`${BASE_URL}/complexSearch`)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('addRecipeInformation', 'true')
  url.searchParams.set('addRecipeNutrition', 'true')
  url.searchParams.set('instructionsRequired', 'true')
  url.searchParams.set('sort', params.sort ?? 'price')
  url.searchParams.set('number', String(params.number ?? 6))
  if (params.query) {
    url.searchParams.set('query', params.query)
  }
  if (params.maxReadyTimeMinutes) {
    url.searchParams.set('maxReadyTime', String(params.maxReadyTimeMinutes))
  }
  if (params.maxPricePerServingEuro) {
    url.searchParams.set(
      'maxPricePerServing',
      String(euroPerRecipeToUsdCentsPerServing(params.maxPricePerServingEuro)),
    )
  }
  if (params.excludeExoticIngredients) {
    url.searchParams.set('excludeIngredients', EXOTIC_INGREDIENTS.join(','))
  }
  if (params.minCalories) {
    url.searchParams.set('minCalories', String(params.minCalories))
  }
  if (params.dishType) {
    url.searchParams.set('type', params.dishType)
  }

  function poolFallback(): BudgetRecipeSuggestion[] | null {
    const fromPool = getFromPool({
      maxReadyTimeMinutes: params.maxReadyTimeMinutes,
      maxPricePerServingEuro: params.maxPricePerServingEuro,
    })
    return fromPool.length > 0 ? fromPool : null
  }

  let res: Response
  try {
    res = await fetch(url.toString())
  } catch (err) {
    // Netzwerkfehler (z. B. offline): auf lokal gesammelte Rezepte
    // zurückfallen statt komplett zu scheitern.
    const fallback = poolFallback()
    if (fallback) {
      lastFetchSource = 'pool-fallback'
      return fallback
    }
    throw err
  }

  if (res.status === 402 || res.status === 429) {
    // 402 = Tageskontingent aufgebraucht, 429 = zu viele Anfragen kurz
    // hintereinander. Beides bedeutet: Spoonacular liefert gerade nichts,
    // also aus dem lokalen Pool bereits gesehener Rezepte bedienen.
    const fallback = poolFallback()
    if (fallback) {
      lastFetchSource = 'pool-fallback'
      return fallback
    }
    throw new SpoonacularQuotaError()
  }
  if (!res.ok) {
    throw new Error(`Spoonacular-Anfrage fehlgeschlagen (${res.status})`)
  }
  const data = (await res.json()) as ComplexSearchResponse

  const results = (data.results ?? []).map((raw) => ({
    recipe: toRecipe(raw),
    prepTimeMinutes: raw.readyInMinutes,
    estimatedCostEuro: priceToEuroPerRecipe(raw.pricePerServing),
  }))

  if (useQueryCache) {
    setQueryCache(params as Record<string, unknown>, results)
  }
  addToPool(results)
  lastFetchSource = 'network'

  return results
}

export interface IngredientMatchRecipe {
  id: string
  name: string
  thumbnail: string
  usedIngredients: string[]
  missedIngredients: string[]
}

interface SpoonacularFindByIngredientsItem {
  id: number
  title: string
  image: string | null
  usedIngredients: { name: string }[]
  missedIngredients: { name: string }[]
}

// Für "Was kann ich kochen?" (findet Rezepte, die möglichst viele der
// übergebenen, im Inventar vorhandenen Zutaten nutzen) und "Was muss weg?"
// (übergebene, bald ablaufende Zutaten sollen unbedingt verwertet werden).
// Deutlich kontingent-sparsamer als eine komplette complexSearch-Anfrage,
// da hier keine vollständigen Rezeptdetails mitgeliefert werden (siehe
// getRecipeInformation für die Details bei Auswahl eines Rezepts).
export async function findRecipesByIngredients(
  ingredientNames: string[],
  number = 8,
  // 1 = möglichst viele der übergebenen Zutaten verwenden (Standard – passt
  // für beide Anwendungsfälle), 2 = möglichst wenige zusätzliche Zutaten
  // nötig.
  ranking: 1 | 2 = 1,
): Promise<IngredientMatchRecipe[]> {
  if (ingredientNames.length === 0) return []

  // Gleiche Zutatenauswahl kurz hintereinander (z. B. nach dem Ansehen eines
  // Vorschlags erneut "Rezeptvorschlag" geklickt) soll nicht jedes Mal neu
  // kontingentiert werden.
  const cached = getIngredientQueryCache(ingredientNames, number, ranking)
  if (cached) {
    lastFetchSource = 'query-cache'
    return cached
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Kein Spoonacular-API-Key konfiguriert.')
  }

  const url = new URL(`${BASE_URL}/findByIngredients`)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('ingredients', ingredientNames.join(','))
  url.searchParams.set('number', String(number))
  url.searchParams.set('ranking', String(ranking))
  url.searchParams.set('ignorePantry', 'true')

  const res = await fetch(url.toString())
  if (res.status === 402 || res.status === 429) {
    throw new SpoonacularQuotaError()
  }
  if (!res.ok) {
    throw new Error(`Spoonacular-Anfrage fehlgeschlagen (${res.status})`)
  }
  const data = (await res.json()) as SpoonacularFindByIngredientsItem[]

  const results = data.map((raw) => ({
    id: `sp-${raw.id}`,
    name: raw.title,
    thumbnail: raw.image ?? '',
    usedIngredients: raw.usedIngredients.map((i) => i.name),
    missedIngredients: raw.missedIngredients.map((i) => i.name),
  }))

  setIngredientQueryCache(ingredientNames, number, ranking, results)
  lastFetchSource = 'network'
  return results
}

// Lädt die vollständigen Rezeptdetails (Zutatenmengen, Zubereitung, Zeit,
// Kosten) zu einer einzelnen Spoonacular-ID nach. Wird für Rezepte
// gebraucht, die über findRecipesByIngredients() gefunden wurden (die
// liefert nur Name/Bild/Zutaten-Abgleich, keine Zubereitung). Prüft zuerst
// den lokalen Detail-Cache und den Rezept-Pool (aus früheren
// complexSearch-Aufrufen) – oft ist das Rezept dort schon vollständig
// vorhanden, dann kostet das Ansehen gar kein zusätzliches Kontingent.
export async function getRecipeInformation(spoonacularId: string): Promise<Recipe> {
  const fromPool = getPoolRecipeById(spoonacularId)
  if (fromPool) return fromPool

  const cached = getCachedRecipeDetail(spoonacularId)
  if (cached) return cached

  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Kein Spoonacular-API-Key konfiguriert.')
  }

  const numericId = spoonacularId.replace(/^sp-/, '')
  const url = new URL(`${BASE_URL}/${numericId}/information`)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('includeNutrition', 'true')

  const res = await fetch(url.toString())
  if (res.status === 402 || res.status === 429) {
    throw new SpoonacularQuotaError()
  }
  if (!res.ok) {
    throw new Error(`Spoonacular-Anfrage fehlgeschlagen (${res.status})`)
  }
  const raw = (await res.json()) as SpoonacularRecipe
  const recipe = toRecipe(raw)
  setCachedRecipeDetail(spoonacularId, recipe)
  return recipe
}
