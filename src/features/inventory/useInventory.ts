import { useSupabaseTable } from '../../lib/useSupabaseTable'
import { showUndo } from '../../lib/undoToast'
import type { ApplianceItem, IngredientItem, UtensilItem } from './types'

/**
 * Zentrale Verwaltung von Utensilien, Öfen/Herden und Zutaten – genutzt von
 * der Inventar-Seite selbst sowie vom Rezepte-Tinder und der Budget-Suche
 * (Utensilien-Filter: "kann ich das mit meinem Inventar kochen?"). Liegt
 * in Supabase, damit die Angaben auf allen Geräten verfügbar sind.
 */
export function useInventory() {
  const utensilsTable = useSupabaseTable<UtensilItem>('utensils')
  const appliancesTable = useSupabaseTable<ApplianceItem>('appliances')
  const ingredientsTable = useSupabaseTable<IngredientItem>('ingredients')

  async function addUtensil(name: string) {
    const created = await utensilsTable.insert({ name })
    if (created) {
      showUndo(`„${name}" hinzugefügt`, () => utensilsTable.remove(created.id))
    }
  }

  function removeUtensil(id: string) {
    const removed = utensilsTable.rows.find((u) => u.id === id)
    utensilsTable.remove(id)
    if (removed) {
      showUndo(`„${removed.name}" entfernt`, () => {
        utensilsTable.insert({ name: removed.name })
      })
    }
  }

  async function addAppliance(name: string) {
    const created = await appliancesTable.insert({ name })
    if (created) {
      showUndo(`„${name}" hinzugefügt`, () => appliancesTable.remove(created.id))
    }
  }

  function removeAppliance(id: string) {
    const removed = appliancesTable.rows.find((a) => a.id === id)
    appliancesTable.remove(id)
    if (removed) {
      showUndo(`„${removed.name}" entfernt`, () => {
        appliancesTable.insert({ name: removed.name })
      })
    }
  }

  async function addIngredient(item: Omit<IngredientItem, 'id'>) {
    const created = await ingredientsTable.insert(item)
    if (created) {
      showUndo(`„${item.name}" hinzugefügt`, () =>
        ingredientsTable.remove(created.id),
      )
    }
  }

  function updateIngredient(id: string, patch: Partial<Omit<IngredientItem, 'id'>>) {
    ingredientsTable.update(id, patch)
  }

  function removeIngredient(id: string) {
    const removed = ingredientsTable.rows.find((i) => i.id === id)
    ingredientsTable.remove(id)
    if (removed) {
      showUndo(`„${removed.name}" entfernt`, () => {
        ingredientsTable.insert({
          name: removed.name,
          amount: removed.amount,
          unit: removed.unit,
        })
      })
    }
  }

  // Für den Geräte-Abgleich (equipmentMatch.ts) reichen die reinen Namen,
  // Utensilien und Öfen/Herde zusammen betrachtet.
  const ownedEquipmentNames = [
    ...utensilsTable.rows.map((u) => u.name),
    ...appliancesTable.rows.map((a) => a.name),
  ]

  return {
    utensils: utensilsTable.rows,
    appliances: appliancesTable.rows,
    ingredients: ingredientsTable.rows,
    addUtensil,
    removeUtensil,
    addAppliance,
    removeAppliance,
    addIngredient,
    updateIngredient,
    removeIngredient,
    ownedEquipmentNames,
    loading:
      utensilsTable.loading ||
      appliancesTable.loading ||
      ingredientsTable.loading,
  }
}
