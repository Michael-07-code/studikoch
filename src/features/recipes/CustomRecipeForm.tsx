import { useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthProvider'
import { useSavedRecipes } from './useSavedRecipes'
import type { Recipe, RecipeIngredient } from './types'
import type { MealType } from './savedTypes'
import { Button, Card, Hint } from '../../components/ui'

const MEAL_TYPES: MealType[] = ['fruehstueck', 'hauptmahlzeit', 'sonstiges']

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  fruehstueck: 'Frühstück',
  hauptmahlzeit: 'Mittag-/Abendessen',
  sonstiges: 'Sonstiges',
}

const EMPTY_INGREDIENT: RecipeIngredient = { name: '', measure: '' }

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB

function newId(): string {
  // crypto.randomUUID() ist in allen modernen Browsern (auch mobil)
  // verfügbar, kein zusätzliches Paket nötig.
  return `custom-${crypto.randomUUID()}`
}

// Formular für ein komplett selbst eingetragenes Rezept (Name, Zutaten,
// Zubereitung, optional ein eigenes Foto) – landet danach ganz normal
// zusammen mit den Spoonacular-/TheMealDB-Rezepten unter "Meine Rezepte".
// Es gibt (noch) keine KI-Verbesserung des Textes – das wurde auf
// ausdrücklichen Wunsch erstmal zurückgestellt (siehe Bugfix-Log).
export default function CustomRecipeForm() {
  const { session } = useAuth()
  const savedRecipes = useSavedRecipes()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [area, setArea] = useState('')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { ...EMPTY_INGREDIENT },
  ])
  const [instructionsText, setInstructionsText] = useState('')
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('')
  const [estimatedCostEuro, setEstimatedCostEuro] = useState('')
  const [mealType, setMealType] = useState<MealType>('sonstiges')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function updateIngredient(index: number, patch: Partial<RecipeIngredient>) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)),
    )
  }

  function addIngredientRow() {
    setIngredients((prev) => [...prev, { ...EMPTY_INGREDIENT }])
  }

  function removeIngredientRow(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setError(null)
    if (file && file.size > MAX_IMAGE_BYTES) {
      setError('Das Bild ist zu groß (max. 8 MB).')
      e.target.value = ''
      return
    }
    setImageFile(file)
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  function resetForm() {
    setName('')
    setCategory('')
    setArea('')
    setIngredients([{ ...EMPTY_INGREDIENT }])
    setInstructionsText('')
    setPrepTimeMinutes('')
    setEstimatedCostEuro('')
    setMealType('sonstiges')
    setImageFile(null)
    setImagePreviewUrl(null)
  }

  async function uploadImage(): Promise<string> {
    if (!imageFile || !supabase || !session) return ''
    const extension = imageFile.name.includes('.')
      ? imageFile.name.slice(imageFile.name.lastIndexOf('.'))
      : ''
    const path = `${session.user.id}/${crypto.randomUUID()}${extension}`
    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(path, imageFile, { cacheControl: '3600', upsert: false })
    if (uploadError) {
      throw new Error(
        'Bild-Upload fehlgeschlagen. Ist der Storage-Bucket "recipe-images" in Supabase eingerichtet (siehe supabase/migration_2026_09_18_custom_recipes.sql)?',
      )
    }
    const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const trimmedName = name.trim()
    const cleanIngredients = ingredients
      .map((ing) => ({ name: ing.name.trim(), measure: ing.measure.trim() }))
      .filter((ing) => ing.name)
    const steps = instructionsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)

    if (!trimmedName) {
      setError('Bitte einen Namen für das Rezept eintragen.')
      return
    }
    if (cleanIngredients.length === 0) {
      setError('Bitte mindestens eine Zutat eintragen.')
      return
    }

    setSaving(true)
    try {
      const thumbnail = await uploadImage()

      const prepTime = parseInt(prepTimeMinutes, 10)
      const cost = parseFloat(estimatedCostEuro.replace(',', '.'))

      const recipe: Recipe = {
        id: newId(),
        name: trimmedName,
        category: category.trim(),
        area: area.trim(),
        instructions: steps,
        ingredients: cleanIngredients,
        thumbnail,
        prepTimeMinutes: Number.isNaN(prepTime) ? undefined : prepTime,
        estimatedCostEuro: Number.isNaN(cost) ? undefined : cost,
      }

      await savedRecipes.saveRecipe(recipe, {
        mealType,
        prepTimeMinutes: recipe.prepTimeMinutes,
        estimatedCostEuro: recipe.estimatedCostEuro,
      })

      setSuccess(true)
      resetForm()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Rezept konnte nicht gespeichert werden.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Hint>
        Eigenes Rezept mit eigenem Foto – landet danach unter „Meine
        Rezepte". Mengenangaben am besten wie „200 g" oder „2 EL" eintragen,
        damit sie sich später auf andere Portionszahlen umrechnen lassen.
      </Hint>

      <Card className="space-y-4">
        <label className="flex flex-col text-sm text-stone-700 dark:text-stone-300">
          Name*
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Nudeln mit Tomatensoße"
            className="mt-1 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 min-w-[10rem] flex-col text-sm text-stone-700 dark:text-stone-300">
            Kategorie (optional)
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="z. B. Nudelgericht"
              className="mt-1 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <label className="flex flex-1 min-w-[10rem] flex-col text-sm text-stone-700 dark:text-stone-300">
            Herkunft (optional)
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="z. B. Italienisch"
              className="mt-1 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
        </div>

        <label className="flex flex-col text-sm text-stone-700 dark:text-stone-300">
          Foto (optional)
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="mt-1 text-sm text-stone-700 dark:text-stone-300 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-100 dark:file:bg-emerald-900/40 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-800 dark:file:text-emerald-300"
          />
        </label>
        {imagePreviewUrl && (
          <img
            src={imagePreviewUrl}
            alt="Vorschau"
            className="h-40 w-full max-w-xs rounded-xl object-cover"
          />
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Zutaten*
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={addIngredientRow}>
            + Zutat
          </Button>
        </div>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(i, { name: e.target.value })}
                placeholder="Zutat, z. B. Zwiebel"
                className="flex-1 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <input
                type="text"
                value={ing.measure}
                onChange={(e) =>
                  updateIngredient(i, { measure: e.target.value })
                }
                placeholder="Menge, z. B. 200 g"
                className="w-32 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredientRow(i)}
                  aria-label="Zutat entfernen"
                  className="rounded-xl px-2 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-red-600 dark:hover:text-red-400"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <Hint>Mengenangaben gelten für 4 Portionen (wie bei den anderen Rezepten in der App).</Hint>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Zubereitung
        </h3>
        <textarea
          value={instructionsText}
          onChange={(e) => setInstructionsText(e.target.value)}
          placeholder={'Ein Schritt pro Zeile, z. B.:\nZwiebel schneiden.\nIn Öl anbraten.\n...'}
          rows={6}
          className="w-full rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <Hint>Jede Zeile wird ein eigener Zubereitungsschritt.</Hint>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col text-sm text-stone-700 dark:text-stone-300">
            Zubereitungszeit (Min., optional)
            <input
              type="number"
              min={0}
              value={prepTimeMinutes}
              onChange={(e) => setPrepTimeMinutes(e.target.value)}
              className="mt-1 w-28 rounded-xl border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col text-sm text-stone-700 dark:text-stone-300">
            Kosten gesamt in € (optional)
            <input
              type="text"
              inputMode="decimal"
              value={estimatedCostEuro}
              onChange={(e) => setEstimatedCostEuro(e.target.value)}
              className="mt-1 w-28 rounded-xl border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div>
          <p className="mb-1 text-sm text-stone-700 dark:text-stone-300">Mahlzeit</p>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMealType(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  mealType === t
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-400 dark:ring-emerald-600'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {MEAL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          ✓ Rezept gespeichert – zu finden unter „Meine Rezepte".
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? 'Speichere …' : 'Rezept speichern'}
      </Button>
    </form>
  )
}
