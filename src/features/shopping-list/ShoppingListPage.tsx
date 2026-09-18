import { useState } from 'react'
import SimpleItemList from '../../components/SimpleItemList'
import AddItemForm from './AddItemForm'
import ShoppingListView from './ShoppingListView'
import { SUPERMARKET_SUGGESTIONS } from './suggestions'
import { useShoppingList } from './useShoppingList'
import { useAppSettings } from '../../lib/useAppSettings'
import PricesPanel from '../prices/PricesPage'
import { PageHeader, TabBar, Hint } from '../../components/ui'

type Tab = 'liste' | 'supermaerkte' | 'preise'

export default function ShoppingListPage() {
  const [tab, setTab] = useState<Tab>('liste')
  const {
    items,
    supermarkets,
    addItem,
    toggleItem,
    removeItem,
    addSupermarket,
    removeSupermarket,
    getPricesFor,
    getCheapestElsewhere,
    updateItemPrice,
    preferredSupermarketId,
    preferredSupermarket,
  } = useShoppingList()
  const { updateAppSettings } = useAppSettings()

  const tabs = [
    { id: 'liste', label: `Einkaufsliste (${items.length})` },
    { id: 'supermaerkte', label: `Supermärkte (${supermarkets.length})` },
    { id: 'preise', label: 'Preisvergleich' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Einkaufsliste" icon="🛒" tone="sky" />

      <TabBar tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />

      {tab === 'liste' && (
        <div className="space-y-4">
          <AddItemForm
            supermarkets={supermarkets}
            onAdd={addItem}
            getPricesFor={getPricesFor}
            preferredSupermarketId={preferredSupermarketId}
          />
          {supermarkets.length === 0 && (
            <Hint>
              Tipp: Lege unter „Supermärkte" deine bevorzugten Läden an.
            </Hint>
          )}
          <ShoppingListView
            items={items}
            supermarkets={supermarkets}
            onToggle={toggleItem}
            onRemove={removeItem}
            getCheapestElsewhere={getCheapestElsewhere}
            preferredSupermarketName={preferredSupermarket?.name ?? null}
          />
        </div>
      )}

      {tab === 'supermaerkte' && (
        <div className="space-y-4">
          {supermarkets.length > 0 && (
            <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 shadow-card">
              <label className="flex flex-col gap-1 text-sm text-stone-700 dark:text-stone-300">
                <span className="font-medium">
                  Bevorzugter Supermarkt für die Einkaufsliste
                </span>
                <select
                  value={preferredSupermarketId ?? ''}
                  onChange={(e) =>
                    updateAppSettings({
                      preferredSupermarketId: e.target.value || null,
                    })
                  }
                  className="rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">
                    Kein bevorzugter Markt (günstigster pro Artikel)
                  </option>
                  {supermarkets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <Hint>
                Neue Artikel werden dann mit dem Preis in diesem einen Markt
                angelegt statt über mehrere Läden verteilt. Artikel, die es
                dort nicht gibt, landen in einem eigenen Bereich in der Liste.
              </Hint>
            </div>
          )}
          <SimpleItemList
            title="Meine Supermärkte"
            items={supermarkets}
            onAdd={addSupermarket}
            onRemove={removeSupermarket}
            suggestions={SUPERMARKET_SUGGESTIONS}
            placeholder="z. B. Rewe"
            emptyText="Noch keine Supermärkte eingetragen."
            datalistId="supermarket-suggestions"
          />
        </div>
      )}

      {tab === 'preise' && (
        <PricesPanel
          items={items}
          supermarkets={supermarkets}
          addItem={addItem}
          updateItemPrice={updateItemPrice}
        />
      )}
    </div>
  )
}
