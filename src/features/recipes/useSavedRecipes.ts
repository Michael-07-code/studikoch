import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthProvider'
import type { Recipe } from './types'
import type { RecipeList, SavedRecipe } from './savedTypes'

// So kommt eine Zeile aus "saved_recipes" zurück (snake_case). Die
// interne Datenbank-ID der Zeile brauchen wir nach außen nicht – überall
// in der App wird ein gespeichertes Rezept über "recipe.id" identifiziert
// (die ursprüngliche TheMealDB-/Spoonacular-ID), das ist auch die
// eindeutige Business-ID in der Datenbank (Spalte "recipe_id").
interface SavedRecipeRow {
  recipe_id: string
  recipe: Recipe
  saved_at: string
  list_ids: string[]
  meal_type: SavedRecipe['mealType']
  prep_time_minutes: number | null
  estimated_cost_euro: number | null
}

function toSavedRecipe(row: SavedRecipeRow): SavedRecipe {
  return {
    recipe: row.recipe,
    savedAt: row.saved_at,
    listIds: row.list_ids ?? [],
    mealType: row.meal_type,
    prepTimeMinutes: row.prep_time_minutes ?? undefined,
    estimatedCostEuro: row.estimated_cost_euro ?? undefined,
  }
}

/**
 * Zentrale Verwaltung der gespeicherten Rezepte + eigenen Listen. Wird von
 * mehreren Stellen genutzt (Rezepte-Seite, Startseite/Tinder, Budget),
 * liegt in Supabase, damit gespeicherte Rezepte auf allen Geräten sichtbar
 * sind.
 */
export function useSavedRecipes() {
  const { session } = useAuth()
  const [saved, setSaved] = useState<SavedRecipe[]>([])
  const [lists, setLists] = useState<RecipeList[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!supabase || !session) {
      setSaved([])
      setLists([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      supabase
        .from('saved_recipes')
        .select('*')
        .eq('user_id', session.user.id)
        .order('saved_at', { ascending: false }),
      supabase
        .from('recipe_lists')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true }),
    ]).then(([savedRes, listsRes]) => {
      if (cancelled) return
      setSaved(((savedRes.data ?? []) as SavedRecipeRow[]).map(toSavedRecipe))
      setLists((listsRes.data ?? []) as RecipeList[])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [session])

  function isSaved(recipeId: string): boolean {
    return saved.some((s) => s.recipe.id === recipeId)
  }

  async function saveRecipe(
    recipe: Recipe,
    options?: {
      listIds?: string[]
      // Z. B. von der Budget-Suche (Spoonacular) bereits bekannt – dann
      // muss der Nutzer sie nicht selbst eintragen.
      prepTimeMinutes?: number
      estimatedCostEuro?: number
    },
  ) {
    if (!supabase || !session) return
    if (isSaved(recipe.id)) return

    const row = {
      user_id: session.user.id,
      recipe_id: recipe.id,
      recipe,
      list_ids: options?.listIds ?? [],
      meal_type: 'sonstiges',
      prep_time_minutes: options?.prepTimeMinutes ?? null,
      estimated_cost_euro: options?.estimatedCostEuro ?? null,
    }
    const { data, error } = await supabase
      .from('saved_recipes')
      .insert(row)
      .select()
      .single()
    if (!error && data) {
      setSaved((prev) => [toSavedRecipe(data as SavedRecipeRow), ...prev])
    }
  }

  async function removeSaved(recipeId: string) {
    if (!supabase || !session) return
    setSaved((prev) => prev.filter((s) => s.recipe.id !== recipeId))
    await supabase
      .from('saved_recipes')
      .delete()
      .eq('user_id', session.user.id)
      .eq('recipe_id', recipeId)
  }

  async function updateSaved(
    recipeId: string,
    patch: Partial<Omit<SavedRecipe, 'recipe' | 'savedAt'>>,
  ) {
    if (!supabase || !session) return
    setSaved((prev) =>
      prev.map((s) => (s.recipe.id === recipeId ? { ...s, ...patch } : s)),
    )
    const dbPatch: Record<string, unknown> = {}
    if (patch.listIds !== undefined) dbPatch.list_ids = patch.listIds
    if (patch.mealType !== undefined) dbPatch.meal_type = patch.mealType
    if (patch.prepTimeMinutes !== undefined)
      dbPatch.prep_time_minutes = patch.prepTimeMinutes
    if (patch.estimatedCostEuro !== undefined)
      dbPatch.estimated_cost_euro = patch.estimatedCostEuro
    if (Object.keys(dbPatch).length === 0) return
    await supabase
      .from('saved_recipes')
      .update(dbPatch)
      .eq('user_id', session.user.id)
      .eq('recipe_id', recipeId)
  }

  async function addList(name: string) {
    if (!supabase || !session) return
    const { data, error } = await supabase
      .from('recipe_lists')
      .insert({ user_id: session.user.id, name })
      .select()
      .single()
    if (!error && data) setLists((prev) => [...prev, data as RecipeList])
  }

  async function removeList(id: string) {
    if (!supabase || !session) return
    const affected = saved.filter((s) => s.listIds.includes(id))

    setLists((prev) => prev.filter((l) => l.id !== id))
    setSaved((prev) =>
      prev.map((s) => ({
        ...s,
        listIds: s.listIds.filter((lid) => lid !== id),
      })),
    )

    await supabase.from('recipe_lists').delete().eq('id', id)
    // Referenzen in gespeicherten Rezepten (list_ids-Array) auch in der
    // Datenbank bereinigen, nicht nur lokal.
    for (const s of affected) {
      await supabase
        .from('saved_recipes')
        .update({ list_ids: s.listIds.filter((lid) => lid !== id) })
        .eq('user_id', session.user.id)
        .eq('recipe_id', s.recipe.id)
    }
  }

  return {
    saved,
    lists,
    isSaved,
    saveRecipe,
    removeSaved,
    updateSaved,
    addList,
    removeList,
    loading,
  }
}
