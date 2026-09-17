import type { BudgetRecipeSuggestion, IngredientMatchRecipe } from './spoonacular'
import type { Recipe } from './types'
import { supabase } from '../../lib/supabaseClient'

// Lokaler Zwischenspeicher für Spoonacular-Ergebnisse (pro Browser/Gerät,
// im localStorage). Zwei Zwecke, beide aus dem Nutzerwunsch "Rezepte lokal
// speichern, damit ich nicht so viele Tokens verbrauche":
//
// 1. Anfrage-Cache: identische Suchen (gleiche Filter) innerhalb von
//    QUERY_TTL_MS liefern das gespeicherte Ergebnis statt erneut das
//    (begrenzte) Spoonacular-Tageskontingent zu belasten.
// 2. Rezept-Pool: jedes von Spoonacular gelieferte Rezept wird zusätzlich
//    in einem größeren, längerfristigen Pool gesammelt. Ist das Kontingent
//    aufgebraucht (Fehler 402/429), greift spoonacular.ts auf diesen Pool
//    zurück, statt gar keine Rezepte mehr anzuzeigen.

const QUERY_PREFIX = 'studikoch:sp-query:'
const POOL_KEY = 'studikoch:sp-pool'
const QUERY_TTL_MS = 24 * 60 * 60 * 1000 // 24h – Rezeptdaten ändern sich praktisch nie
// Großzügiger dimensioniert, seit sich herausgestellt hat, dass Spoonacular
// im Gratis-Tarif tatsächlich nur 50 (nicht wie ursprünglich angenommen 150)
// Anfragen pro Tag erlaubt – der lokale Cache muss also einen deutlich
// größeren Anteil der Nutzung abdecken. Kostet nur etwas localStorage-Platz
// (ein paar hundert KB), das ist der bessere Kompromiss.
const MAX_QUERY_ENTRIES = 70
const MAX_POOL_SIZE = 320

interface QueryCacheEntry {
  storedAt: number
  results: BudgetRecipeSuggestion[]
}

interface PoolEntry {
  addedAt: number
  suggestion: BudgetRecipeSuggestion
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function buildQueryKey(params: Record<string, unknown>): string {
  const normalized = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      if (params[k] !== undefined) acc[k] = params[k]
      return acc
    }, {})
  return QUERY_PREFIX + JSON.stringify(normalized)
}

export function getQueryCache(
  params: Record<string, unknown>,
): BudgetRecipeSuggestion[] | null {
  const entry = safeParse<QueryCacheEntry>(
    window.localStorage.getItem(buildQueryKey(params)),
  )
  if (!entry) return null
  if (Date.now() - entry.storedAt > QUERY_TTL_MS) return null
  return entry.results
}

export function setQueryCache(
  params: Record<string, unknown>,
  results: BudgetRecipeSuggestion[],
): void {
  try {
    const key = buildQueryKey(params)
    const entry: QueryCacheEntry = { storedAt: Date.now(), results }
    window.localStorage.setItem(key, JSON.stringify(entry))

    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(QUERY_PREFIX)) keys.push(k)
    }
    if (keys.length > MAX_QUERY_ENTRIES) {
      const withAge = keys
        .map((k) => ({
          key: k,
          storedAt: safeParse<QueryCacheEntry>(window.localStorage.getItem(k))
            ?.storedAt ?? 0,
        }))
        .sort((a, b) => a.storedAt - b.storedAt)
      for (let i = 0; i < keys.length - MAX_QUERY_ENTRIES; i++) {
        window.localStorage.removeItem(withAge[i].key)
      }
    }
  } catch {
    // Speicher voll oder nicht verfügbar (z. B. privater Modus) – dann
    // funktioniert die App einfach ohne Cache weiter.
  }
}

function readPool(): PoolEntry[] {
  return safeParse<PoolEntry[]>(window.localStorage.getItem(POOL_KEY)) ?? []
}

// Fügt neu geladene Rezepte in den Pool ein (dedupliziert nach Rezept-ID,
// neuere Version ersetzt ältere) und begrenzt die Poolgröße.
export function addToPool(suggestions: BudgetRecipeSuggestion[]): void {
  if (suggestions.length === 0) return
  try {
    const existing = readPool()
    const byId = new Map(existing.map((e) => [e.suggestion.recipe.id, e]))
    const now = Date.now()
    for (const s of suggestions) {
      byId.set(s.recipe.id, { addedAt: now, suggestion: s })
    }
    let merged = Array.from(byId.values()).sort((a, b) => b.addedAt - a.addedAt)
    if (merged.length > MAX_POOL_SIZE) {
      merged = merged.slice(0, MAX_POOL_SIZE)
    }
    window.localStorage.setItem(POOL_KEY, JSON.stringify(merged))
  } catch {
    // s.o. – kein Cache ist kein Fehlerfall
  }
}

export interface PoolFilter {
  maxReadyTimeMinutes?: number
  maxPricePerServingEuro?: number
  excludeIds?: Set<string>
}

// Best-effort-Filterung des Pools, wenn Spoonacular gerade nicht erreichbar
// ist (Kontingent aufgebraucht). Nicht so präzise wie eine echte API-Suche
// (z. B. kein Kalorien-/Zutaten-Filter, da nicht mit im Pool gespeichert),
// aber besser als gar keine Vorschläge.
export function getFromPool(filter: PoolFilter = {}): BudgetRecipeSuggestion[] {
  const entries = readPool()
  return entries
    .map((e) => e.suggestion)
    .filter((s) => !filter.excludeIds?.has(s.recipe.id))
    .filter((s) =>
      filter.maxReadyTimeMinutes
        ? (s.prepTimeMinutes ?? Infinity) <= filter.maxReadyTimeMinutes
        : true,
    )
    .filter((s) =>
      filter.maxPricePerServingEuro
        ? (s.estimatedCostEuro ?? Infinity) / 4 <= filter.maxPricePerServingEuro
        : true,
    )
}

export function poolSize(): number {
  return readPool().length
}

// Ist ein Rezept (z. B. per findByIngredients gefunden) bereits vollständig
// im Pool vorhanden (aus einer früheren complexSearch-Anfrage), sparen wir
// uns den zusätzlichen Detail-Aufruf komplett.
export function getPoolRecipeById(id: string): Recipe | null {
  const match = readPool().find((e) => e.suggestion.recipe.id === id)
  return match ? match.suggestion.recipe : null
}

const DETAIL_PREFIX = 'studikoch:sp-detail:'
const DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 Tage – Rezeptdetails ändern sich so gut wie nie
const MAX_DETAIL_ENTRIES = 150

interface DetailCacheEntry {
  storedAt: number
  recipe: Recipe
}

// Cache für einzeln nachgeladene Rezeptdetails (z. B. über
// getRecipeInformation() nach "Was kann ich kochen?"). Deckt genau den
// Nutzerwunsch ab: "Rezepte lokal speichern, die ich schon gesehen habe."
export function getCachedRecipeDetail(id: string): Recipe | null {
  const entry = safeParse<DetailCacheEntry>(
    window.localStorage.getItem(DETAIL_PREFIX + id),
  )
  if (!entry) return null
  if (Date.now() - entry.storedAt > DETAIL_TTL_MS) return null
  return entry.recipe
}

// Dauerhafter, geräteübergreifender Cache in Supabase (Tabelle
// "recipe_cache", siehe supabase/schema.sql bzw. migration_2026_09.sql).
// Ergänzt den localStorage-Cache oben (schnelle erste Stufe, aber nur auf
// diesem Gerät gültig): einmal von irgendeinem Gerät abgefragte Rezepte
// stehen damit auf allen Geräten dauerhaft zur Verfügung, ohne erneut das
// (knappe) Spoonacular-Tageskontingent zu belasten. Fehler (z. B. offline,
// kein Supabase konfiguriert) werden bewusst verschluckt – der Cache ist
// immer nur eine Optimierung, nie eine Voraussetzung zum Funktionieren.
export async function getServerRecipeDetail(id: string): Promise<Recipe | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase
      .from('recipe_cache')
      .select('recipe')
      .eq('recipe_id', id)
      .maybeSingle()
    return (data?.recipe as Recipe | undefined) ?? null
  } catch {
    return null
  }
}

export async function setServerRecipeDetail(id: string, recipe: Recipe): Promise<void> {
  if (!supabase) return
  try {
    await supabase
      .from('recipe_cache')
      .upsert(
        { recipe_id: id, recipe, cached_at: new Date().toISOString() },
        { onConflict: 'recipe_id' },
      )
  } catch {
    // s.o. – kein Cache ist kein Fehlerfall
  }
}

export function setCachedRecipeDetail(id: string, recipe: Recipe): void {
  try {
    window.localStorage.setItem(
      DETAIL_PREFIX + id,
      JSON.stringify({ storedAt: Date.now(), recipe }),
    )
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(DETAIL_PREFIX)) keys.push(k)
    }
    if (keys.length > MAX_DETAIL_ENTRIES) {
      const withAge = keys
        .map((k) => ({
          key: k,
          storedAt:
            safeParse<DetailCacheEntry>(window.localStorage.getItem(k))
              ?.storedAt ?? 0,
        }))
        .sort((a, b) => a.storedAt - b.storedAt)
      for (let i = 0; i < keys.length - MAX_DETAIL_ENTRIES; i++) {
        window.localStorage.removeItem(withAge[i].key)
      }
    }
  } catch {
    // s.o.
  }
}

// Cache für findByIngredients-Anfragen ("Was kann ich kochen?" / "Was muss
// weg?"). Bisher komplett ungecacht – jeder Klick auf "Rezeptvorschlag" hat
// das (knappe) Tageskontingent belastet, auch bei identischer Zutatenauswahl
// (z. B. nach dem bloßen Ansehen eines Vorschlags erneut gesucht). Kürzere
// TTL als die übrigen Caches, weil sich das Inventar öfter ändert als
// Rezeptdaten.
const INGREDIENT_QUERY_PREFIX = 'studikoch:sp-ingq:'
const INGREDIENT_QUERY_TTL_MS = 2 * 60 * 60 * 1000 // 2h
const MAX_INGREDIENT_QUERY_ENTRIES = 30

interface IngredientQueryCacheEntry {
  storedAt: number
  results: IngredientMatchRecipe[]
}

function buildIngredientQueryKey(
  ingredientNames: string[],
  number: number,
  ranking: number,
): string {
  const normalized = [...ingredientNames]
    .map((n) => n.trim().toLowerCase())
    .sort()
  return `${INGREDIENT_QUERY_PREFIX}${ranking}:${number}:${normalized.join(',')}`
}

// Dauerhafte, geräteübergreifende Variante des Zutaten-Suchcaches (siehe
// Kommentar bei getServerRecipeDetail oben) – Tabelle
// "ingredient_query_cache". Anders als der lokale Cache (2h TTL, da sich
// das Inventar oft ändert) hat diese Variante keine Ablaufzeit: dieselbe
// exakte Zutatenkombination liefert ohnehin fast immer dieselben
// Spoonacular-Treffer, und "für immer speichern" war ausdrücklicher
// Nutzerwunsch.
export async function getServerIngredientQuery(
  ingredientNames: string[],
  number: number,
  ranking: number,
): Promise<IngredientMatchRecipe[] | null> {
  if (!supabase) return null
  try {
    const key = buildIngredientQueryKey(ingredientNames, number, ranking)
    const { data } = await supabase
      .from('ingredient_query_cache')
      .select('results')
      .eq('query_key', key)
      .maybeSingle()
    return (data?.results as IngredientMatchRecipe[] | undefined) ?? null
  } catch {
    return null
  }
}

export async function setServerIngredientQuery(
  ingredientNames: string[],
  number: number,
  ranking: number,
  results: IngredientMatchRecipe[],
): Promise<void> {
  if (!supabase) return
  try {
    const key = buildIngredientQueryKey(ingredientNames, number, ranking)
    await supabase.from('ingredient_query_cache').upsert(
      { query_key: key, results, cached_at: new Date().toISOString() },
      { onConflict: 'query_key' },
    )
  } catch {
    // s.o.
  }
}

export function getIngredientQueryCache(
  ingredientNames: string[],
  number: number,
  ranking: number,
): IngredientMatchRecipe[] | null {
  const entry = safeParse<IngredientQueryCacheEntry>(
    window.localStorage.getItem(
      buildIngredientQueryKey(ingredientNames, number, ranking),
    ),
  )
  if (!entry) return null
  if (Date.now() - entry.storedAt > INGREDIENT_QUERY_TTL_MS) return null
  return entry.results
}

export function setIngredientQueryCache(
  ingredientNames: string[],
  number: number,
  ranking: number,
  results: IngredientMatchRecipe[],
): void {
  try {
    const key = buildIngredientQueryKey(ingredientNames, number, ranking)
    const entry: IngredientQueryCacheEntry = { storedAt: Date.now(), results }
    window.localStorage.setItem(key, JSON.stringify(entry))

    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(INGREDIENT_QUERY_PREFIX)) keys.push(k)
    }
    if (keys.length > MAX_INGREDIENT_QUERY_ENTRIES) {
      const withAge = keys
        .map((k) => ({
          key: k,
          storedAt:
            safeParse<IngredientQueryCacheEntry>(window.localStorage.getItem(k))
              ?.storedAt ?? 0,
        }))
        .sort((a, b) => a.storedAt - b.storedAt)
      for (let i = 0; i < keys.length - MAX_INGREDIENT_QUERY_ENTRIES; i++) {
        window.localStorage.removeItem(withAge[i].key)
      }
    }
  } catch {
    // s.o.
  }
}
