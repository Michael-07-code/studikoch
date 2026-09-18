import type {
  IngredientMatchRecipe,
  Recipe,
  RecipeIngredient,
  RecipeSummary,
} from './types'
import { isStudentFriendly } from './simpleFilter'

// TheMealDB: kostenlos nutzbar mit dem öffentlichen Test-Key "1".
// https://www.themealdb.com/api.php
const BASE_URL = 'https://www.themealdb.com/api/json/v1/1'

// Rohformat der API. Zutaten/Mengen kommen als 20 einzeln nummerierte
// Felder (strIngredient1..20 / strMeasure1..20), die wir unten in ein
// Array umwandeln.
interface RawMeal {
  idMeal: string
  strMeal: string
  strCategory: string | null
  strArea: string | null
  strInstructions: string | null
  strMealThumb: string | null
  strSource: string | null
  [key: string]: string | null | undefined
}

interface RawMealSummary {
  idMeal: string
  strMeal: string
  strMealThumb: string | null
}

interface MealListResponse<T> {
  meals: T[] | null
}

function extractIngredients(meal: RawMeal): RecipeIngredient[] {
  const ingredients: RecipeIngredient[] = []
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]
    const measure = meal[`strMeasure${i}`]
    if (name && name.trim()) {
      ingredients.push({
        name: name.trim(),
        measure: measure ? measure.trim() : '',
      })
    }
  }
  return ingredients
}

function splitInstructions(raw: string | null): string[] {
  return (raw ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function toRecipe(meal: RawMeal): Recipe {
  return {
    id: meal.idMeal,
    name: meal.strMeal,
    category: meal.strCategory ?? '',
    area: meal.strArea ?? '',
    instructions: splitInstructions(meal.strInstructions),
    thumbnail: meal.strMealThumb ?? '',
    sourceUrl: meal.strSource ?? undefined,
    ingredients: extractIngredients(meal),
  }
}

function toSummary(meal: RawMealSummary): RecipeSummary {
  return {
    id: meal.idMeal,
    name: meal.strMeal,
    thumbnail: meal.strMealThumb ?? '',
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Anfrage an TheMealDB fehlgeschlagen (${res.status})`)
  }
  return (await res.json()) as T
}

export async function searchRecipesByName(query: string): Promise<Recipe[]> {
  const data = await fetchJson<MealListResponse<RawMeal>>(
    `${BASE_URL}/search.php?s=${encodeURIComponent(query)}`,
  )
  return (data.meals ?? []).map(toRecipe)
}

export async function filterRecipesByIngredient(
  ingredient: string,
): Promise<RecipeSummary[]> {
  // TheMealDB erwartet mehrteilige Zutaten mit Unterstrich, z. B. "chicken_breast".
  const normalized = ingredient.trim().toLowerCase().replace(/\s+/g, '_')
  const data = await fetchJson<MealListResponse<RawMealSummary>>(
    `${BASE_URL}/filter.php?i=${encodeURIComponent(normalized)}`,
  )
  return (data.meals ?? []).map(toSummary)
}

export async function filterRecipesByCategory(
  category: string,
): Promise<RecipeSummary[]> {
  const data = await fetchJson<MealListResponse<RawMealSummary>>(
    `${BASE_URL}/filter.php?c=${encodeURIComponent(category)}`,
  )
  return (data.meals ?? []).map(toSummary)
}

// TheMealDB-Kategorien, die sich als Mittag-/Abendessen eignen (laut
// Nutzereinstellung ohnehin gleichwertig, siehe useAppSettings). "Dessert"
// bewusst ausgeschlossen, damit nicht plötzlich ein Kuchen als Hauptgericht
// vorgeschlagen wird. "Seafood" ebenfalls ausgeschlossen – Nutzerwunsch,
// keine Meeresfrüchte-Gerichte (Beispiel: Krabbensalat).
const MAIN_COURSE_CATEGORIES = [
  'Chicken',
  'Beef',
  'Pasta',
  'Vegetarian',
  'Pork',
  'Vegan',
  'Miscellaneous',
  'Side',
  'Lamb',
]

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

// Liefert bis zu "count" zufällige, vollständige Rezepte (inkl. Zutaten und
// Zubereitung, in einem Aufruf pro Rezept) von TheMealDB – als kostenlose
// zweite Quelle neben Spoonacular (siehe recipeSource.ts): entweder als
// Ersatz, wenn dessen Tageskontingent aufgebraucht ist, oder um dem
// Rezepte-Tinder mehr Abwechslung zu geben. TheMealDB kennt keine
// Frühstück/Mittag/Abend-Unterscheidung außer der Kategorie "Breakfast" –
// für Mittag-/Abendessen wird aus den übrigen Hauptgerichte-Kategorien
// gewählt.
export async function getRandomRecipesForMeal(
  mealType: 'fruehstueck' | 'hauptmahlzeit' | null,
  count: number,
  excludeIds: Set<string> = new Set(),
): Promise<Recipe[]> {
  const categories = shuffle(
    mealType === 'fruehstueck' ? ['Breakfast'] : MAIN_COURSE_CATEGORIES,
  )

  const candidateIds: string[] = []
  for (const category of categories) {
    if (candidateIds.length >= count * 3) break
    try {
      const summaries = await filterRecipesByCategory(category)
      for (const s of shuffle(summaries)) {
        if (!excludeIds.has(s.id) && !candidateIds.includes(s.id)) {
          candidateIds.push(s.id)
        }
      }
    } catch {
      // Diese Kategorie überspringen, mit den übrigen weitermachen –
      // einzelne fehlgeschlagene Anfragen sollen die ganze Ergänzung nicht
      // scheitern lassen.
    }
  }

  // Mehr Kandidaten laden als gebraucht, da ein Teil gleich wieder durch den
  // "studententauglich"-Filter fliegt (siehe simpleFilter.ts) – vorher war
  // diese Ausweichquelle komplett ungefiltert (auch aufwendige Gourmet-
  // Rezepte und Meeresfrüchte-Reste aus "Miscellaneous" landeten hier).
  const shuffledIds = shuffle(candidateIds).slice(0, count * 3)
  const recipes = await Promise.all(
    shuffledIds.map((id) => getRecipeById(id).catch(() => null)),
  )
  const loaded = recipes.filter((r): r is Recipe => r !== null)
  const filtered = loaded.filter(isStudentFriendly)
  return (filtered.length > 0 ? filtered : loaded).slice(0, count)
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const data = await fetchJson<MealListResponse<RawMeal>>(
    `${BASE_URL}/lookup.php?i=${encodeURIComponent(id)}`,
  )
  const meal = data.meals?.[0]
  return meal ? toRecipe(meal) : null
}

export async function getRandomRecipe(): Promise<Recipe | null> {
  const data = await fetchJson<MealListResponse<RawMeal>>(
    `${BASE_URL}/random.php`,
  )
  const meal = data.meals?.[0]
  return meal ? toRecipe(meal) : null
}

// Kostenlose Ausweichquelle für "Was muss weg?"/"Was kann ich kochen?", wenn
// Spoonaculars findByIngredients-Kontingent aufgebraucht ist (vorher gab es
// dort gar keinen Fallback – die Suche schlug komplett fehl). TheMealDB kann
// nur nach jeweils einer Zutat gleichzeitig filtern, deshalb wird hier pro
// gewünschter Zutat einzeln gefiltert und gezählt, in wie vielen Treffern ein
// Rezept jeweils vorkommt – eine grobe, aber kostenlose Näherung an
// Spoonaculars "möglichst viele der Zutaten verwenden"-Ranking.
export async function findRecipesByIngredientsFallback(
  ingredientNames: string[],
  count: number,
): Promise<IngredientMatchRecipe[]> {
  if (ingredientNames.length === 0) return []

  const hitCounts = new Map<string, { summary: RecipeSummary; count: number }>()
  await Promise.all(
    ingredientNames.map(async (ingredient) => {
      try {
        const summaries = await filterRecipesByIngredient(ingredient)
        for (const s of summaries) {
          const entry = hitCounts.get(s.id)
          if (entry) entry.count++
          else hitCounts.set(s.id, { summary: s, count: 1 })
        }
      } catch {
        // Diese Zutat überspringen, mit den übrigen weitermachen.
      }
    }),
  )

  const ranked = Array.from(hitCounts.values()).sort((a, b) => b.count - a.count)
  // Mehr Kandidaten laden als gebraucht, da danach noch der
  // "studententauglich"-Filter greift (siehe simpleFilter.ts).
  const candidates = ranked.slice(0, count * 3)

  const recipes = await Promise.all(
    candidates.map((c) => getRecipeById(c.summary.id).catch(() => null)),
  )
  const loaded = recipes.filter((r): r is Recipe => r !== null)
  const filtered = loaded.filter(isStudentFriendly)
  const chosen = (filtered.length > 0 ? filtered : loaded).slice(0, count)

  return chosen.map((recipe) => {
    const recipeIngredientNames = recipe.ingredients.map((i) =>
      i.name.toLowerCase(),
    )
    const usedIngredients = ingredientNames.filter((name) => {
      const normalized = name.trim().toLowerCase()
      return recipeIngredientNames.some(
        (rn) => rn.includes(normalized) || normalized.includes(rn),
      )
    })
    const missedIngredients = ingredientNames.filter(
      (name) => !usedIngredients.includes(name),
    )
    return {
      id: recipe.id,
      name: recipe.name,
      thumbnail: recipe.thumbnail,
      usedIngredients,
      missedIngredients,
    }
  })
}
