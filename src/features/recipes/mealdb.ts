import type { Recipe, RecipeIngredient, RecipeSummary } from './types'

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
