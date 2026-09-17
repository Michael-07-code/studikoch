import type { ItemCategory } from './categories'

export interface Supermarket {
  id: string
  name: string
}

export interface ShoppingListItem {
  id: string
  name: string
  amount?: number
  unit?: string
  price?: number
  supermarketId: string | null
  checked: boolean
  // Optional: manuell gewählt. Fehlt sie, wird beim Anzeigen automatisch
  // per Stichwort-Heuristik kategorisiert (siehe categorizeItem).
  category?: ItemCategory
}
