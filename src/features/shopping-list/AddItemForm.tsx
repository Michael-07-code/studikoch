import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Supermarket, ShoppingListItem } from './types'
import { CATEGORY_LABELS, CATEGORY_ORDER, categorizeItem } from './categories'
import type { ItemCategory } from './categories'
import type { PriceEntry } from './priceBook'
import {
  cheapestPerStore,
  loadPriceData,
  storeLabel,
  type PriceProduct,
} from '../prices/heissePreise'
import { Button, Card, Hint } from '../../components/ui'

type NewItem = Omit<ShoppingListItem, 'id' | 'checked'>

interface Props {
  supermarkets: Supermarket[]
  onAdd: (item: NewItem) => void
  // Optional: liefert bekannte Preise aus dem selbst gepflegten Preisbuch,
  // damit man beim Eintippen direkt sieht, was der Artikel zuletzt wo
  // gekostet hat (siehe useShoppingList/priceBook.ts).
  getPricesFor?: (name: string) => PriceEntry[]
}

// Einfaches Debounce für die Live-Preissuche beim Tippen, damit nicht bei
// jedem Tastendruck sofort der (recht große) Preis-Datensatz durchsucht wird.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export default function AddItemForm({
  supermarkets,
  onAdd,
  getPricesFor,
}: Props) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [price, setPrice] = useState('')
  const [supermarketId, setSupermarketId] = useState('')
  const [category, setCategory] = useState<ItemCategory | ''>('')

  const [priceProducts, setPriceProducts] = useState<PriceProduct[] | null>(
    null,
  )
  useEffect(() => {
    // Lädt (gecacht) im Hintergrund, sobald das Formular sichtbar ist, damit
    // die Live-Preis-Vorschau ohne spürbare Wartezeit erscheint. Schlägt der
    // Abruf fehl (z. B. offline), bleibt das Formular trotzdem nutzbar –
    // Artikel werden dann einfach ohne automatischen Preis hinzugefügt.
    loadPriceData()
      .then(setPriceProducts)
      .catch(() => setPriceProducts(null))
  }, [])

  const debouncedName = useDebouncedValue(name.trim(), 250)

  function parseOptionalNumber(text: string): number | undefined {
    if (!text.trim()) return undefined
    const parsed = parseFloat(text.replace(',', '.'))
    return Number.isNaN(parsed) ? undefined : parsed
  }

  const autoMatches = useMemo(() => {
    if (!priceProducts || !debouncedName || debouncedName.length < 3) return []
    return cheapestPerStore(priceProducts, debouncedName, 3)
  }, [priceProducts, debouncedName])

  const bestAutoMatch = autoMatches[0] ?? null
  // Manuell im "Mehr Optionen"-Bereich gesetzter Preis/Supermarkt geht immer
  // vor – sonst wird beim Speichern automatisch der günstigste Live-Preis
  // verwendet (siehe useShoppingList.addItem -> enrichWithPrice).
  const willAutoAttachPrice =
    !price.trim() && !supermarketId && bestAutoMatch !== null

  const knownPrices = useMemo(() => {
    const trimmed = name.trim()
    if (!trimmed || !getPricesFor) return []
    return getPricesFor(trimmed)
  }, [name, getPricesFor])

  const priceHints = knownPrices
    .map((entry) => {
      const market = supermarkets.find((s) => s.id === entry.supermarketId)
      return market ? { name: market.name, price: entry.price } : null
    })
    .filter((h): h is { name: string; price: number } => h !== null)
    .sort((a, b) => a.price - b.price)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    onAdd({
      name: trimmedName,
      amount: parseOptionalNumber(amount),
      unit: unit.trim() || undefined,
      price: parseOptionalNumber(price),
      supermarketId: supermarketId || null,
      category: category || undefined,
    })

    setName('')
    setAmount('')
    setUnit('')
    setPrice('')
    setSupermarketId('')
    setCategory('')
  }

  return (
    <Card className="space-y-2" padded={false}>
      <form onSubmit={handleSubmit} className="space-y-2 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Artikel, z. B. Milch"
            className="w-full flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Menge"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-20"
            />
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Einheit"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-24"
            />
          </div>
        </div>

        {bestAutoMatch && willAutoAttachPrice && (
          <p className="text-xs font-medium text-emerald-700">
            💶 {bestAutoMatch.price.toFixed(2)} € bei{' '}
            {storeLabel(bestAutoMatch.store)}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-medium text-emerald-700 underline"
          >
            {showAdvanced ? 'Weniger Optionen' : 'Mehr Optionen'}
          </button>
          <Button type="submit" size="sm">
            Hinzufügen
          </Button>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 gap-2 border-t border-stone-100 pt-2 sm:grid-cols-3">
            <select
              value={supermarketId}
              onChange={(e) => setSupermarketId(e.target.value)}
              className="rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Automatisch (günstigster Supermarkt)</option>
              {supermarkets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Preis € (manuell)"
              className="rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory | '')}
              className="rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">
                Automatisch{' '}
                {name.trim()
                  ? `(${CATEGORY_LABELS[categorizeItem(name.trim())]})`
                  : ''}
              </option>
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        )}
      </form>
      {priceHints.length > 0 && (
        <div className="px-3 pb-3">
          <Hint>
            Zuletzt eingetragen: {priceHints
              .map((h) => `${h.name} ${h.price.toFixed(2)} €`)
              .join(' · ')}
          </Hint>
        </div>
      )}
    </Card>
  )
}
