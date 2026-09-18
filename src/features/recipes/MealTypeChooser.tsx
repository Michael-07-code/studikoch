import type { MealType } from './savedTypes'
import { Button } from '../../components/ui'

const OPTIONS: { value: MealType; label: string }[] = [
  { value: 'fruehstueck', label: '🌅 Frühstück' },
  { value: 'hauptmahlzeit', label: '🍽️ Mittag-/Abendessen' },
]

// Kleine Abfrage direkt beim Speichern eines Rezepts: wann isst du das
// normalerweise? Erscheint nur, wenn die Einstellung "beim Speichern
// fragen" aktiv ist (siehe useAppSettings) – sonst wird direkt mit
// "sonstiges" gespeichert. Als echtes, zentriertes Popup (fester Overlay
// über dem restlichen Inhalt) statt als Element im normalen Seitenfluss,
// damit man dafür nicht erst herunterscrollen muss (Nutzerwunsch, betraf
// vor allem das Rezepte-Tinder mit seiner hohen Karte).
export default function MealTypeChooser({
  onPick,
  onCancel,
}: {
  onPick: (mealType: MealType) => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs space-y-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 shadow-card-hover"
      >
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
          Wann isst du das meistens?
        </p>
        <div className="flex flex-col gap-2">
          {OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant="outline"
              fullWidth
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
    </div>
  )
}
