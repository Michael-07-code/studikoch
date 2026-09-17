import { useMemo } from 'react'
import type { ShoppingListItem, Supermarket } from './types'
import { useSupabaseTable } from '../../lib/useSupabaseTable'
import { useUserSettings } from '../../lib/useUserSettings'
import { useAppSettings } from '../../lib/useAppSettings'
import { showUndo } from '../../lib/undoToast'
import {
  normalizeItemName,
  type PriceBook,
  type PriceEntry,
} from './priceBook'
import { cheapestPerStore, loadPriceData, storeLabel } from '../prices/heissePreise'

type NewItem = Omit<ShoppingListItem, 'id' | 'checked'>

// So kommen die Zeilen aus der "shopping_list_items"-Tabelle zurück
// (snake_case Spaltennamen) – toItem() übersetzt das ins camelCase
// ShoppingListItem, das der Rest der App erwartet.
interface ShoppingListRow {
  id: string
  name: string
  amount: number | null
  unit: string | null
  price: number | null
  supermarket_id: string | null
  checked: boolean
  category: string | null
}

function toItem(row: ShoppingListRow): ShoppingListItem {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount ?? undefined,
    unit: row.unit ?? undefined,
    price: row.price ?? undefined,
    supermarketId: row.supermarket_id,
    checked: row.checked,
    category: (row.category ?? undefined) as ShoppingListItem['category'],
  }
}

/**
 * Zentrale Verwaltung der Einkaufsliste + Supermärkte. Wird sowohl von der
 * Einkaufslisten-Seite selbst genutzt als auch von den Rezepte-Seiten
 * (Button "Zutaten zur Einkaufsliste hinzufügen") und der Preise-Seite.
 * Liegt in Supabase (statt localStorage), damit die Liste auf allen
 * Geräten sichtbar ist.
 */
export function useShoppingList() {
  const itemsTable = useSupabaseTable<ShoppingListRow>('shopping_list_items')
  const marketsTable = useSupabaseTable<Supermarket>('supermarkets')
  const { settings, patch } = useUserSettings()
  const { appSettings } = useAppSettings()

  const items = useMemo(() => itemsTable.rows.map(toItem), [itemsTable.rows])
  const supermarkets = marketsTable.rows
  const priceBook = (settings?.price_book as PriceBook | undefined) ?? {}
  const preferredSupermarketId = appSettings.preferredSupermarketId
  const preferredSupermarket = preferredSupermarketId
    ? (supermarkets.find((s) => s.id === preferredSupermarketId) ?? null)
    : null

  // Selbst gepflegtes "Preisbuch": merkt sich, was ein Artikel zuletzt in
  // welchem Supermarkt gekostet hat (ergänzt die Live-Preise auf der
  // Preise-Seite für Supermärkte/Artikel, die dort nicht erfasst sind).
  function recordPrice(
    name: string,
    supermarketId: string | null,
    price?: number,
  ) {
    if (!supermarketId || price === undefined) return
    const key = normalizeItemName(name)
    const existing = priceBook[key] ?? []
    const entry: PriceEntry = {
      supermarketId,
      price,
      updatedAt: new Date().toISOString(),
    }
    const withoutSameMarket = existing.filter(
      (e) => e.supermarketId !== supermarketId,
    )
    patch({
      price_book: { ...priceBook, [key]: [...withoutSameMarket, entry] },
    })
  }

  function getPricesFor(name: string): PriceEntry[] {
    return priceBook[normalizeItemName(name)] ?? []
  }

  function getCheapestElsewhere(
    name: string,
    marketsList: Supermarket[],
    excludeSupermarketId?: string | null,
  ): { supermarketName: string; price: number } | null {
    const entries = getPricesFor(name).filter(
      (e) => e.supermarketId !== excludeSupermarketId,
    )
    if (entries.length === 0) return null
    const cheapest = entries.reduce((min, e) => (e.price < min.price ? e : min))
    const market = marketsList.find((s) => s.id === cheapest.supermarketId)
    if (!market) return null
    return { supermarketName: market.name, price: cheapest.price }
  }

  // Findet einen bereits vorhandenen eigenen Supermarkt-Eintrag mit diesem
  // Namen (unabhängig von Groß-/Kleinschreibung) oder legt einen neuen an –
  // damit Live-Preise aus "Heisse Preise" (z. B. "Billa") automatisch einem
  // Supermarkt in der eigenen Liste zugeordnet werden können, ohne dass man
  // ihn vorher selbst unter "Supermärkte" angelegt haben muss.
  async function findOrCreateSupermarket(
    name: string,
  ): Promise<Supermarket | null> {
    const existing = marketsTable.rows.find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    )
    if (existing) return existing
    return marketsTable.insert({ name })
  }

  // Reichert einen neuen Einkaufslisten-Eintrag automatisch mit dem
  // günstigsten bekannten Live-Preis (siehe features/prices/heissePreise.ts)
  // an, falls noch kein Preis/Supermarkt manuell gesetzt wurde. So kommen
  // Zutaten – egal ob manuell oder aus einem Rezept hinzugefügt – gleich mit
  // Preis für den jeweiligen Supermarkt in die Liste. Schlägt der Abruf fehl
  // (z. B. offline), wird der Artikel einfach ohne Preis hinzugefügt.
  //
  // "resolveMarket" ist austauschbar, damit addMany() beim gleichzeitigen
  // Hinzufügen mehrerer Zutaten (z. B. ein ganzes Rezept) alle Anfragen für
  // denselben Supermarkt-Namen dieselbe (bereits laufende) Anlage abwarten
  // lassen kann – sonst würden parallele Aufrufe von findOrCreateSupermarket
  // denselben Supermarkt mehrfach anlegen (Race Condition).
  async function enrichWithPrice(
    input: NewItem,
    resolveMarket: (name: string) => Promise<Supermarket | null> = findOrCreateSupermarket,
  ): Promise<NewItem> {
    if (input.price !== undefined && input.supermarketId) return input
    try {
      const products = await loadPriceData()

      // Bevorzugten Supermarkt gesetzt (siehe Reiter "Supermärkte"): Preis
      // gezielt für DIESEN Markt suchen statt den insgesamt günstigsten –
      // Nutzerwunsch, nicht für ein Rezept über mehrere Läden verteilt
      // einkaufen zu müssen. Kein Treffer dort -> Artikel bleibt ohne
      // Supermarkt/Preis, damit er in der Liste als "nicht dort erhältlich"
      // auffällt statt automatisch anderswo hin zu wandern.
      if (preferredSupermarket) {
        const candidates = cheapestPerStore(products, input.name, 10)
        const ownMatch = candidates.find(
          (c) =>
            storeLabel(c.store).toLowerCase() ===
            preferredSupermarket.name.trim().toLowerCase(),
        )
        if (!ownMatch) return input
        return {
          ...input,
          price: input.price ?? ownMatch.price,
          supermarketId: input.supermarketId ?? preferredSupermarket.id,
        }
      }

      const match = cheapestPerStore(products, input.name, 1)[0]
      if (!match) return input
      const market = await resolveMarket(storeLabel(match.store))
      return {
        ...input,
        price: input.price ?? match.price,
        supermarketId: input.supermarketId ?? market?.id ?? null,
      }
    } catch {
      return input
    }
  }

  // Bereits vorhandener, noch nicht abgehakter Eintrag mit demselben Namen
  // (und derselben Einheit, damit z. B. "200 g" und "1 Stück" nicht
  // versehentlich zusammengezählt werden) – wird beim Hinzufügen mit diesem
  // zusammengeführt statt einen doppelten Eintrag anzulegen. Das ist der
  // Kern des Fixes für "mehrfaches Hinzufügen erzeugt Dopplungen".
  function findMergeCandidate(input: NewItem): ShoppingListItem | undefined {
    const key = normalizeItemName(input.name)
    return items.find(
      (i) =>
        !i.checked &&
        normalizeItemName(i.name) === key &&
        (i.unit ?? '').trim().toLowerCase() ===
          (input.unit ?? '').trim().toLowerCase(),
    )
  }

  async function mergeInto(existing: ShoppingListItem, input: NewItem) {
    const mergedAmount =
      existing.amount !== undefined && input.amount !== undefined
        ? Math.round((existing.amount + input.amount) * 100) / 100
        : (existing.amount ?? input.amount)
    const price = input.price ?? existing.price
    const supermarketId = input.supermarketId ?? existing.supermarketId
    await itemsTable.update(existing.id, {
      amount: mergedAmount ?? null,
      price: price ?? null,
      supermarket_id: supermarketId,
    })
    recordPrice(input.name, supermarketId, price)
  }

  async function addItem(input: NewItem) {
    const enriched = await enrichWithPrice(input)
    const match = findMergeCandidate(enriched)
    if (match) {
      await mergeInto(match, enriched)
      return
    }
    const created = await itemsTable.insert({
      name: enriched.name,
      amount: enriched.amount ?? null,
      unit: enriched.unit ?? null,
      price: enriched.price ?? null,
      supermarket_id: enriched.supermarketId,
      category: enriched.category ?? null,
      checked: false,
    })
    recordPrice(enriched.name, enriched.supermarketId, enriched.price)
    if (created) {
      showUndo(`„${enriched.name}" zur Liste hinzugefügt`, () =>
        itemsTable.remove(created.id),
      )
    }
  }

  async function addMany(inputs: NewItem[]) {
    // Ein geteilter Cache pro Aufruf: mehrere Zutaten desselben Rezepts, die
    // zufällig beim selben Supermarkt am günstigsten sind, teilen sich hier
    // dieselbe (einmalige) Anlage statt sich gegenseitig zu duplizieren.
    const marketPromises = new Map<string, Promise<Supermarket | null>>()
    function resolveMarket(name: string): Promise<Supermarket | null> {
      const key = name.toLowerCase()
      let pending = marketPromises.get(key)
      if (!pending) {
        pending = findOrCreateSupermarket(name)
        marketPromises.set(key, pending)
      }
      return pending
    }

    const enrichedList = await Promise.all(
      inputs.map((input) => enrichWithPrice(input, resolveMarket)),
    )
    const toInsert: NewItem[] = []
    for (const enriched of enrichedList) {
      const match = findMergeCandidate(enriched)
      if (match) {
        await mergeInto(match, enriched)
      } else {
        toInsert.push(enriched)
        recordPrice(enriched.name, enriched.supermarketId, enriched.price)
      }
    }
    if (toInsert.length > 0) {
      const created = await itemsTable.insertMany(
        toInsert.map((input) => ({
          name: input.name,
          amount: input.amount ?? null,
          unit: input.unit ?? null,
          price: input.price ?? null,
          supermarket_id: input.supermarketId,
          category: input.category ?? null,
          checked: false,
        })),
      )
      if (created.length > 0) {
        showUndo(
          created.length === 1
            ? `„${created[0].name}" zur Liste hinzugefügt`
            : `${created.length} Artikel zur Liste hinzugefügt`,
          () => {
            for (const row of created) itemsTable.remove(row.id)
          },
        )
      }
    }
  }

  function toggleItem(id: string) {
    const current = items.find((i) => i.id === id)
    if (!current) return
    itemsTable.update(id, { checked: !current.checked })
  }

  function removeItem(id: string) {
    const removed = items.find((i) => i.id === id)
    itemsTable.remove(id)
    if (removed) {
      showUndo(`„${removed.name}" entfernt`, () => {
        itemsTable.insert({
          name: removed.name,
          amount: removed.amount ?? null,
          unit: removed.unit ?? null,
          price: removed.price ?? null,
          supermarket_id: removed.supermarketId,
          category: removed.category ?? null,
          checked: removed.checked,
        })
      })
    }
  }

  // Übernimmt einen (z. B. auf der Preise-Seite gefundenen) Live-Preis in
  // einen bestehenden Einkaufslisten-Eintrag und merkt ihn zugleich im
  // Preisbuch vor.
  function updateItemPrice(id: string, supermarketId: string, price: number) {
    itemsTable.update(id, { supermarket_id: supermarketId, price })
    const item = items.find((i) => i.id === id)
    if (item) recordPrice(item.name, supermarketId, price)
  }

  async function addSupermarket(name: string) {
    const created = await marketsTable.insert({ name })
    if (created) {
      showUndo(`„${name}" hinzugefügt`, () => marketsTable.remove(created.id))
    }
  }

  function removeSupermarket(id: string) {
    const removed = marketsTable.rows.find((s) => s.id === id)
    marketsTable.remove(id)
    // Die Datenbank setzt "supermarket_id" bei betroffenen Artikeln dank
    // "on delete set null" automatisch zurück – den lokalen Stand
    // aktualisieren wir hier direkt mit, damit die UI sofort passt.
    itemsTable.setRows((prev) =>
      prev.map((r) =>
        r.supermarket_id === id ? { ...r, supermarket_id: null } : r,
      ),
    )
    if (removed) {
      showUndo(`„${removed.name}" entfernt`, () => {
        marketsTable.insert({ name: removed.name })
      })
    }
  }

  return {
    items,
    supermarkets,
    addItem,
    addMany,
    toggleItem,
    removeItem,
    updateItemPrice,
    addSupermarket,
    removeSupermarket,
    getPricesFor,
    getCheapestElsewhere,
    preferredSupermarketId,
    preferredSupermarket,
    loading: itemsTable.loading || marketsTable.loading,
  }
}
