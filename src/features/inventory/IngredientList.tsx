import { useEffect, useState, type FormEvent } from 'react'
import type { IngredientItem } from './types'
import { UNIT_SUGGESTIONS } from './suggestions'
import { lookupBarcode } from '../../lib/openFoodFacts'
import BarcodeScanner from '../../components/BarcodeScanner'
import { Button, EmptyState, Hint } from '../../components/ui'

interface Props {
  items: IngredientItem[]
  onAdd: (item: Omit<IngredientItem, 'id'>) => void
  onRemove: (id: string) => void
  /** Öffnet den Scanner sofort beim Laden – z. B. wenn von der Startseiten-
   * Kachel "Barcode scannen" direkt hierher gesprungen wurde. */
  autoOpenScanner?: boolean
}

export default function IngredientList({
  items,
  onAdd,
  onRemove,
  autoOpenScanner,
}: Props) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('Stück')
  const [scanning, setScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)

  useEffect(() => {
    if (autoOpenScanner) setScanning(true)
    // Nur beim ersten Laden reagieren, nicht bei jedem Re-Render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDetected(code: string) {
    setScanning(false)
    setScanStatus('Suche Produkt …')
    const product = await lookupBarcode(code)
    if (!product) {
      setScanStatus(
        `Kein Produkt zu Barcode ${code} gefunden. Name manuell eintragen.`,
      )
      return
    }
    setName(product.name)
    // Grobe Übernahme der Packungsgröße, falls als reine Zahl+Einheit
    // erkennbar (z. B. "500 g") – sonst bleibt die Menge leer zum manuellen
    // Eintragen.
    const match = product.quantity?.match(/^(\d+(?:[.,]\d+)?)\s*(\w+)/)
    if (match) {
      setAmount(match[1].replace(',', '.'))
      const unitGuess = UNIT_SUGGESTIONS.find(
        (u) => u.toLowerCase() === match[2].toLowerCase(),
      )
      if (unitGuess) setUnit(unitGuess)
    }
    setScanStatus(`Gefunden: ${product.name}. Menge prüfen und hinzufügen.`)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const parsedAmount = parseFloat(amount.replace(',', '.'))
    if (!trimmedName || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return
    }
    onAdd({ name: trimmedName, amount: parsedAmount, unit })
    setName('')
    setAmount('')
    setScanStatus(null)
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Zutaten</h2>

      {/* Barcode-Scan ist die schnellste Art, eine Zutat zu erfassen – daher
          als große, eigenständige Kachel ganz oben statt als kleiner Button
          im Formular, wo er bisher leicht übersehen wurde. */}
      <button
        type="button"
        onClick={() => {
          setScanStatus(null)
          setScanning(true)
        }}
        className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3.5 text-left shadow-sm transition-all duration-150 hover:border-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:shadow-md active:scale-[0.99]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xl text-white shadow-md shadow-emerald-950/15">
          📷
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            Produkt per Barcode scannen
          </span>
          <span className="block text-xs text-emerald-700 dark:text-emerald-400">
            Schneller als Tippen – Kamera öffnet sich sofort
          </span>
        </span>
      </button>

      {scanning && (
        <BarcodeScanner
          onDetected={handleDetected}
          onClose={() => setScanning(false)}
        />
      )}
      {scanStatus && <Hint>{scanStatus}</Hint>}

      <div className="flex items-center gap-3 pt-1 text-xs font-medium text-stone-400 dark:text-stone-500">
        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
        oder manuell eintragen
        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Zutat, z. B. Reis"
          className="w-full min-w-0 flex-1 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:min-w-[10rem]"
        />
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Menge"
            className="w-full rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-24"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-auto"
          >
            {UNIT_SUGGESTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="shrink-0">
          Hinzufügen
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState>Noch keine Zutaten eingetragen.</EmptyState>
      ) : (
        <ul className="divide-y divide-stone-200 dark:divide-stone-700 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-card">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span>
                {item.name} — {item.amount} {item.unit}
              </span>
              <button
                onClick={() => onRemove(item.id)}
                className="text-stone-400 dark:text-stone-500 transition-colors hover:text-red-600 dark:hover:text-red-400"
                aria-label={`${item.name} entfernen`}
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
