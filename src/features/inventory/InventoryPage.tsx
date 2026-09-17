import { useState } from 'react'
import { useLocation } from 'react-router'
import SimpleItemList from '../../components/SimpleItemList'
import IngredientList from './IngredientList'
import { UTENSIL_SUGGESTIONS, APPLIANCE_SUGGESTIONS } from './suggestions'
import { useInventory } from './useInventory'
import { PageHeader, TabBar } from '../../components/ui'

type Tab = 'utensilien' | 'oefen' | 'zutaten'
type NavState = { tab?: Tab; autoScan?: boolean }

export default function InventoryPage() {
  // Erlaubt z. B. der Startseiten-Kachel "Barcode scannen", direkt im
  // Zutaten-Reiter mit bereits geöffnetem Scanner zu landen.
  const location = useLocation()
  const navState = location.state as NavState | null
  const [tab, setTab] = useState<Tab>(navState?.tab ?? 'utensilien')

  const {
    utensils,
    appliances,
    ingredients,
    addUtensil,
    removeUtensil,
    addAppliance,
    removeAppliance,
    addIngredient,
    removeIngredient,
  } = useInventory()

  const tabs = [
    { id: 'utensilien', label: `Utensilien (${utensils.length})` },
    { id: 'oefen', label: `Öfen & Herde (${appliances.length})` },
    { id: 'zutaten', label: `Zutaten (${ingredients.length})` },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utensilien & Zutaten"
        description="Was du zum Kochen zur Verfügung hast – wird für passende Rezeptvorschläge genutzt."
        icon="🧺"
        tone="amber"
      />

      <TabBar tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />

      {tab === 'utensilien' && (
        <SimpleItemList
          title="Kochutensilien"
          items={utensils}
          onAdd={addUtensil}
          onRemove={removeUtensil}
          suggestions={UTENSIL_SUGGESTIONS}
          placeholder="z. B. Pfanne"
          emptyText="Noch keine Utensilien eingetragen."
          datalistId="utensil-suggestions"
        />
      )}

      {tab === 'oefen' && (
        <SimpleItemList
          title="Öfen & Herde"
          items={appliances}
          onAdd={addAppliance}
          onRemove={removeAppliance}
          suggestions={APPLIANCE_SUGGESTIONS}
          placeholder="z. B. Backofen"
          emptyText="Noch keine Geräte eingetragen."
          datalistId="appliance-suggestions"
        />
      )}

      {tab === 'zutaten' && (
        <IngredientList
          items={ingredients}
          onAdd={addIngredient}
          onRemove={removeIngredient}
          autoOpenScanner={navState?.tab === 'zutaten' && navState?.autoScan}
        />
      )}
    </div>
  )
}
