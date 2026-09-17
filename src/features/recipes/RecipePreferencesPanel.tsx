import { useState } from 'react'
import {
  useRecipePreferences,
  type RecipePreferences,
} from './useRecipePreferences'
import { Button, Hint } from '../../components/ui'

interface Props {
  // Zeigt den Utensilien-Filter-Schalter direkt in der Kopfzeile an,
  // zusätzlich zum Einstellungen-Button (z. B. oben im Rezepte-Tinder).
  showInventoryToggleInline?: boolean
}

function NumberOrNullInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null
  onChange: (next: number | null) => void
  placeholder: string
}) {
  return (
    <input
      type="number"
      min={0}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value
        if (!raw.trim()) {
          onChange(null)
          return
        }
        const parsed = parseFloat(raw.replace(',', '.'))
        onChange(Number.isNaN(parsed) ? null : parsed)
      }}
      placeholder={placeholder}
      className="mt-1 w-28 rounded-xl border border-stone-300 px-2 py-1.5 text-sm"
    />
  )
}

/**
 * Ein Einstellungen-Button mit aufklappbarem Panel für die "Studenten-
 * freundlich"-Präferenzen (max. Zeit/Kosten, alltägliche Zutaten,
 * sättigend, Utensilien-Filter). Wird sowohl im Rezepte-Tinder auf der
 * Startseite als auch in der Budget-Suche verwendet, damit es nur eine
 * Stelle zum Konfigurieren gibt.
 */
export default function RecipePreferencesPanel({
  showInventoryToggleInline,
}: Props) {
  const { preferences, updatePreferences } = useRecipePreferences()
  const [open, setOpen] = useState(false)

  function patch(p: Partial<RecipePreferences>) {
    updatePreferences(p)
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-3">
        {showInventoryToggleInline && (
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={preferences.respectInventory}
              onChange={(e) => patch({ respectInventory: e.target.checked })}
              className="size-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            Nur mit meinem Inventar kochbar
          </label>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="border border-stone-300"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          ⚙ Einstellungen
        </Button>
      </div>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-[min(18rem,85vw)] space-y-3 rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-card-hover">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-stone-900">
              Rezept-Einstellungen
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="text-stone-400 hover:text-stone-600"
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>
          <Hint>Gilt für Tinder und Budget-Suche.</Hint>

          <label className="block">
            Max. Zubereitungszeit (Min.)
            <NumberOrNullInput
              value={preferences.maxTimeMinutes}
              onChange={(v) => patch({ maxTimeMinutes: v })}
              placeholder="ohne Limit"
            />
          </label>

          <label className="block">
            Max. Kosten pro Portion (€)
            <NumberOrNullInput
              value={preferences.maxPriceEuro}
              onChange={(v) => patch({ maxPriceEuro: v })}
              placeholder="ohne Limit"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.everydayIngredientsOnly}
              onChange={(e) =>
                patch({ everydayIngredientsOnly: e.target.checked })
              }
              className="size-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            Nur alltägliche Zutaten (keine Exoten)
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.fillingOnly}
              onChange={(e) => patch({ fillingOnly: e.target.checked })}
              className="size-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            Nur sättigende Gerichte
          </label>

          {!showInventoryToggleInline && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.respectInventory}
                onChange={(e) =>
                  patch({ respectInventory: e.target.checked })
                }
                className="size-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              Nur mit meinem Inventar kochbar
            </label>
          )}

          <Hint>
            Filter wirken nur bei Rezepten mit Zeit-/Kostendaten
            (Spoonacular).
          </Hint>
        </div>
      )}
    </div>
  )
}
