import type { MealType } from './savedTypes'
import { Button } from '../../components/ui'

const OPTIONS: { value: MealType; label: string }[] = [
  { value: 'fruehstueck', label: '🌅 Frühstück' },
  { value: 'mittagessen', label: '☀️ Mittagessen' },
  { value: 'abendessen', label: '🌙 Abendessen' },
]

// Kleine Abfrage direkt beim Speichern eines Rezepts: wann isst du das
// normalerweise? Erscheint nur, wenn die Einstellung "beim Speichern
// fragen" aktiv ist (siehe useAppSettings) – sonst wird direkt mit
// "sonstiges" gespeichert.
export default function MealTypeChooser({
  onPick,
  onCancel,
}: {
  onPick: (mealType: MealType) => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 p-3">
      <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
        Wann isst du das meistens?
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onPick(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-stone-500 dark:text-stone-400 underline"
      >
        Abbrechen
      </button>
    </div>
  )
}
