import { useState } from 'react'
import SimpleItemList from '../../components/SimpleItemList'
import AddItemForm from './AddItemForm'
import ShoppingListView from './ShoppingListView'
import { SUPERMARKET_SUGGESTIONS } from './suggestions'
import { useShoppingList } from './useShoppingList'
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
  } = useShoppingList()

  const tabs = [
    { id: 'liste', label: `Einkaufsliste (${items.length})` },
    { id: 'supermaerkte', label: `Supermärkte (${supermarkets.length})` },
    { id: 'preise', label: 'Preisvergleich' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Einkaufsliste" />

      <TabBar tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />

      {tab === 'liste' && (
        <div className="space-y-4">
          <AddItemForm
            supermarkets={supermarkets}
            onAdd={addItem}
            getPricesFor={getPricesFor}
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
          />
        </div>
      )}

      {tab === 'supermaerkte' && (
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
