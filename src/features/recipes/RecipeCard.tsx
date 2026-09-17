import type { RecipeSummary } from './types'

interface Props {
  recipe: RecipeSummary
  // Übersetzter Anzeigename – kann kurz nach dem Laden noch dem
  // englischen Original entsprechen, bis die Übersetzung eintrifft.
  displayName: string
  onSelect: () => void
}

export default function RecipeCard({ recipe, displayName, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white text-left shadow-card transition-shadow hover:shadow-card-hover"
    >
      {recipe.thumbnail && (
        <img
          src={`${recipe.thumbnail}/medium`}
          alt={displayName}
          className="h-32 w-full object-cover"
          loading="lazy"
        />
      )}
      <div className="p-3">
        <p className="text-sm font-medium text-stone-900">{displayName}</p>
      </div>
    </button>
  )
}
