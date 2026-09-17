import { useEffect, useMemo, useState } from 'react'
import type { useShoppingList } from '../shopping-list/useShoppingList'
import {
  cheapestPerStore,
  loadPriceData,
  searchProducts,
  storeLabel,
  type PriceProduct,
} from './heissePreise'
import type { Supermarket } from '../shopping-list/types'
import { Card, Hint } from '../../components/ui'

type ShoppingListApi = ReturnType<typeof useShoppingList>

// Findet – falls vorhanden – den eigenen Supermarkt-Eintrag, der zu einem
// Store aus dem Preis-Datensatz passt (z. B. "spar" -> ein Eintrag "Spar"
// oder "Spar Reindlgasse" in der eigenen Supermärkte-Liste).
function findOwnSupermarket(
  store: string,
  supermarkets: Supermarket[],
): Supermarket | null {
  const label = storeLabel(store).toLowerCase()
  return (
    supermarkets.find((s) => s.name.toLowerCase().includes(label)) ?? null
  )
}

function ProductRow({
  product,
  ownSupermarket,
  onAdd,
}: {
  product: PriceProduct
  ownSupermarket: Supermarket | null
  onAdd: (product: PriceProduct, supermarket: Supermarket) => void
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-stone-900">{product.name}</p>
        <p className="text-xs text-stone-500">
          {storeLabel(product.store)}
          {product.quantity && product.unit
            ? ` · ${product.quantity} ${product.unit}`
            : ''}
          {product.bio ? ' · Bio' : ''}
        </p>
      </div>
      <span className="shrink-0 font-medium text-stone-900">
        {product.price.toFixed(2)} €
      </span>
      {ownSupermarket ? (
        <button
          onClick={() => onAdd(product, ownSupermarket)}
          className="shrink-0 rounded-xl border-2 border-emerald-700 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
        >
          Übernehmen
        </button>
      ) : (
        <span
          className="shrink-0 text-xs text-stone-400"
          title={`Lege "${storeLabel(product.store)}" unter Einkaufsliste → Supermärkte an, um den Preis zu übernehmen.`}
        >
          –
        </span>
      )}
    </li>
  )
}

/**
 * Live-Supermarktpreise für Österreich (Spar, Billa, Hofer, Lidl, dm,
 * MPreis) über den offenen Datensatz von "Heisse Preise", der auf der
 * gesetzlichen Preistransparenz-Pflicht großer Ketten basiert. Kein
 * offizielles Regierungsangebot, keine Verfügbarkeits-/Aktualitätsgarantie
 * – aber die einzige uns bekannte kostenlose, halbwegs verlässliche Quelle
 * für echte Supermarktpreise (im Unterschied zu Deutschland).
 *
 * Lebt als interner Reiter in der Einkaufsliste (nicht mehr als eigene
 * Navigationsseite) – daher kein eigener PageHeader, sondern nur eine kurze
 * Quellenangabe. "items"/"supermarkets"/... kommen als Props von
 * ShoppingListPage (statt aus einem eigenen useShoppingList()-Aufruf),
 * damit beide Reiter (Liste/Preise) dieselbe Daten-Instanz teilen – ein hier
 * übernommener Preis taucht sonst erst nach einem Neuladen in der
 * Einkaufsliste auf.
 */
export default function PricesPanel({
  items,
  supermarkets,
  updateItemPrice,
  addItem,
}: Pick<
  ShoppingListApi,
  'items' | 'supermarkets' | 'updateItemPrice' | 'addItem'
>) {
  const [products, setProducts] = useState<PriceProduct[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadPriceData()
      .then((data) => {
        if (!cancelled) setProducts(data)
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'Preisdaten konnten nicht geladen werden. Das kann an deiner Internetverbindung liegen oder daran, dass die Datenquelle (heisse-preise.io, ein unabhängiges Community-Projekt) gerade nicht erreichbar ist.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const searchResults = useMemo(
    () => (products ? searchProducts(products, query) : []),
    [products, query],
  )

  const uniqueItemNames = useMemo(
    () => [...new Set(items.map((i) => i.name.trim()).filter(Boolean))],
    [items],
  )

  function handleAdd(product: PriceProduct, supermarket: Supermarket) {
    addItem({
      name: product.name,
      price: product.price,
      unit: product.unit,
      amount: product.quantity,
      supermarketId: supermarket.id,
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-500">
        Tagesaktuelle Preise von Spar, Billa, Hofer, Lidl, dm & MPreis – via{' '}
        <a
          href="https://heissepreise.github.io/"
          target="_blank"
          rel="noreferrer"
          className="text-emerald-700 underline"
        >
          Heisse Preise
        </a>
        .
      </p>

      {loading && <p className="text-sm text-stone-500">Lade Preisdaten …</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && products && (
        <>
          {uniqueItemNames.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-stone-900">
                Preise für deine Einkaufsliste
              </h2>
              <div className="space-y-3">
                {uniqueItemNames.map((name) => {
                  const matches = cheapestPerStore(products, name, 3)
                  if (matches.length === 0) return null
                  const listItems = items.filter((i) => i.name.trim() === name)
                  return (
                    <Card key={name} className="p-3">
                      <p className="mb-2 text-sm font-medium text-stone-900">
                        {name}
                      </p>
                      <ul className="space-y-1">
                        {matches.map((m) => {
                          const ownSupermarket = findOwnSupermarket(
                            m.store,
                            supermarkets,
                          )
                          return (
                            <li
                              key={`${m.store}-${m.name}`}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="min-w-0 flex-1 truncate text-stone-600">
                                {storeLabel(m.store)} · {m.name}
                              </span>
                              <span className="shrink-0 font-medium text-stone-900">
                                {m.price.toFixed(2)} €
                              </span>
                              {ownSupermarket && listItems.length > 0 ? (
                                <button
                                  onClick={() =>
                                    updateItemPrice(
                                      listItems[0].id,
                                      ownSupermarket.id,
                                      m.price,
                                    )
                                  }
                                  className="shrink-0 rounded-xl border-2 border-emerald-700 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                                >
                                  Preis übernehmen
                                </button>
                              ) : (
                                <span className="w-[6.5rem] shrink-0" />
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">
              Artikel suchen
            </h2>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="z. B. Milch, Nudeln, Toastbrot"
              className="w-full max-w-sm rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <Hint>Penny, Wochenmärkte & Co. sind nicht enthalten.</Hint>
            {query.trim() && searchResults.length === 0 && (
              <p className="text-sm text-stone-500">
                Keine Treffer für „{query}".
              </p>
            )}
            {searchResults.length > 0 && (
              <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-card">
                {searchResults.map((p) => (
                  <ProductRow
                    key={`${p.store}-${p.name}`}
                    product={p}
                    ownSupermarket={findOwnSupermarket(p.store, supermarkets)}
                    onAdd={handleAdd}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
