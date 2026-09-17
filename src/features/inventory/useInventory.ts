import { useSupabaseTable } from '../../lib/useSupabaseTable'
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

  function addUtensil(name: string) {
    utensilsTable.insert({ name })
  }

  function removeUtensil(id: string) {
    utensilsTable.remove(id)
  }

  function addAppliance(name: string) {
    appliancesTable.insert({ name })
  }

  function removeAppliance(id: string) {
    appliancesTable.remove(id)
  }

  function addIngredient(item: Omit<IngredientItem, 'id'>) {
    ingredientsTable.insert(item)
  }

  function updateIngredient(id: string, patch: Partial<Omit<IngredientItem, 'id'>>) {
    ingredientsTable.update(id, patch)
  }

  function removeIngredient(id: string) {
    ingredientsTable.remove(id)
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
