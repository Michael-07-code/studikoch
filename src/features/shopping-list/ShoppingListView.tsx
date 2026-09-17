import type { ShoppingListItem, Supermarket } from './types'
import { CATEGORY_LABELS, CATEGORY_ORDER, categorizeItem } from './categories'

interface Props {
  items: ShoppingListItem[]
  supermarkets: Supermarket[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  // Optional: für den "günstiger bei X"-Hinweis aus dem selbst gepflegten
  // Preisbuch (siehe useShoppingList/priceBook.ts). Ohne Live-Preis-API von
  // SPAR & Co. ist das die einzig realistische Quelle für einen Vergleich.
  getCheapestElsewhere?: (
    name: string,
    supermarkets: Supermarket[],
    excludeSupermarketId?: string | null,
  ) => { supermarketName: string; price: number } | null
}

function supermarketName(
  supermarkets: Supermarket[],
  id: string | null,
): string {
  if (!id) return 'Ohne Supermarkt'
  return supermarkets.find((s) => s.id === id)?.name ?? 'Ohne Supermarkt'
}

export default function ShoppingListView({
  items,
  supermarkets,
  onToggle,
  onRemove,
  getCheapestElsewhere,
}: Props) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Deine Einkaufsliste ist noch leer.
      </p>
    )
  }

  // Gruppierung: zuerst nach Supermarkt (damit man weiß, wo man was
  // braucht), innerhalb dessen nach Kategorie in der Reihenfolge eines
  // typischen Rundgangs durch den Laden (siehe categories.ts). Fehlt eine
  // manuell gesetzte Kategorie, wird sie per Stichwort-Heuristik aus dem
  // Namen abgeleitet.
  const supermarketGroups = new Map<string, ShoppingListItem[]>()
  for (const item of items) {
    const key = supermarketName(supermarkets, item.supermarketId)
    const list = supermarketGroups.get(key) ?? []
    list.push(item)
    supermarketGroups.set(key, list)
  }

  const total = items.reduce((sum, item) => sum + (item.price ?? 0), 0)
  const totalChecked = items
    .filter((i) => i.checked)
    .reduce((sum, item) => sum + (item.price ?? 0), 0)

  return (
    <div className="space-y-5">
      {[...supermarketGroups.entries()].map(([marketName, marketItems]) => {
        const marketTotal = marketItems.reduce(
          (sum, item) => sum + (item.price ?? 0),
          0,
        )

        const categoryGroups = new Map<string, ShoppingListItem[]>()
        for (const item of marketItems) {
          const cat = item.category ?? categorizeItem(item.name)
          const list = categoryGroups.get(cat) ?? []
          list.push(item)
          categoryGroups.set(cat, list)
        }
        const sortedCategories = CATEGORY_ORDER.filter((c) =>
          categoryGroups.has(c),
        )

        return (
          <div key={marketName}>
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-stone-900">
                {marketName}
              </h3>
              {marketTotal > 0 && (
                <span className="text-xs text-stone-500">
                  {marketTotal.toFixed(2)} €
                </span>
              )}
            </div>
            <div className="space-y-3">
              {sortedCategories.map((cat) => {
                const catItems = (categoryGroups.get(cat) ?? []).sort((a, b) =>
                  a.name.localeCompare(b.name, 'de'),
                )
                return (
                  <div key={cat}>
                    <h4 className="mb-1 pl-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                      {CATEGORY_LABELS[cat]}
                    </h4>
                    <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-card">
                      {catItems.map((item) => {
                        const cheaperElsewhere = getCheapestElsewhere?.(
                          item.name,
                          supermarkets,
                          item.supermarketId,
                        )
                        const showCheaperHint =
                          cheaperElsewhere &&
                          (item.price === undefined ||
                            cheaperElsewhere.price < item.price)
                        return (
                          <li
                            key={item.id}
                            className="flex items-center gap-3 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => onToggle(item.id)}
                              className="size-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span
                              className={`flex-1 ${
                                item.checked ? 'text-stone-400 line-through' : ''
                              }`}
                            >
                              {item.name}
                              {(item.amount !== undefined || item.unit) && (
                                <span className="text-stone-400">
                                  {' '}
                                  — {item.amount ?? ''} {item.unit ?? ''}
                                </span>
                              )}
                              {showCheaperHint && (
                                <span className="block text-xs text-emerald-600">
                                  günstiger bei {cheaperElsewhere!.supermarketName}
                                  : {cheaperElsewhere!.price.toFixed(2)} €
                                </span>
                              )}
                            </span>
                            {item.price !== undefined && (
                              <span className="text-stone-500">
                                {item.price.toFixed(2)} €
                              </span>
                            )}
                            <button
                              onClick={() => onRemove(item.id)}
                              className="text-stone-400 transition-colors hover:text-red-600"
                              aria-label={`${item.name} entfernen`}
                            >
                              Entfernen
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex justify-between border-t border-stone-200 pt-3 text-sm font-medium text-stone-900">
        <span>Gesamt (geschätzt)</span>
        <span>{total.toFixed(2)} €</span>
      </div>
      {totalChecked > 0 && (
        <div className="flex justify-between text-xs text-stone-500">
          <span>Bereits im Wagen</span>
          <span>{totalChecked.toFixed(2)} €</span>
        </div>
      )}
    </div>
  )
}
