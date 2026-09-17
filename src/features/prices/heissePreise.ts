// Österreich verpflichtet große Supermarktketten inzwischen, ihre Preise
// maschinenlesbar zu veröffentlichen (Preistransparenz-Regelung). Das
// nicht-kommerzielle Open-Source-Projekt "Heisse Preise"
// (https://github.com/badlogic/heissepreise, Seite:
// https://heissepreise.github.io/) bündelt diese Daten täglich in einem
// einzigen, frei zugänglichen JSON-Datensatz – ganz ohne API-Key. Das ist
// die einzige uns bekannte, halbwegs verlässliche und kostenlose Quelle für
// echte Supermarktpreise in Österreich (im Unterschied zu Deutschland, wo
// es nur kostenpflichtige/inoffizielle Scraper gibt).
//
// Wichtig: Kein offizielles Regierungsprojekt, keine Verfügbarkeits- oder
// Aktualitäts-Garantie, keine dokumentierte Lizenz für die Daten – für den
// privaten Gebrauch (Preisvergleich) aber genau das, wonach gesucht wurde.
const DATA_URL = 'https://heisse-preise.io/data/latest-canonical.json'

export const STORE_LABELS: Record<string, string> = {
  spar: 'Spar',
  billa: 'Billa',
  hofer: 'Hofer',
  lidl: 'Lidl',
  dm: 'dm',
  mpreis: 'MPreis',
}

export function storeLabel(store: string): string {
  return STORE_LABELS[store] ?? store
}

export interface PriceProduct {
  store: string
  name: string
  price: number
  unit?: string
  quantity?: number
  bio?: boolean
}

interface RawProduct {
  store: string
  name: string
  price: number
  unit?: string
  quantity?: number
  bio?: boolean
}

let cache: PriceProduct[] | null = null
let cacheLoadedAt: number | null = null
let inflight: Promise<PriceProduct[]> | null = null

// Die Quelle wird laut Projekt täglich aktualisiert – ein paar Stunden
// zwischenspeichern reicht, um nicht bei jedem Seitenaufruf neu zu laden.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

/**
 * Lädt den kompletten Preis-Datensatz (kann mehrere MB groß sein – auf
 * mobilen Datenverbindungen bewusst nur bei Bedarf, also erst beim
 * Öffnen der Preise-Seite, nicht beim App-Start). Wird pro Sitzung
 * zwischengespeichert, damit nicht jede Suche neu lädt.
 */
export async function loadPriceData(): Promise<PriceProduct[]> {
  if (cache && cacheLoadedAt && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cache
  }
  if (inflight) return inflight

  inflight = (async () => {
    const res = await fetch(DATA_URL)
    if (!res.ok) {
      throw new Error(`Preisdaten konnten nicht geladen werden (${res.status})`)
    }
    const raw = (await res.json()) as RawProduct[]
    const products: PriceProduct[] = raw.map((p) => ({
      store: p.store,
      name: p.name,
      price: p.price,
      unit: p.unit,
      quantity: p.quantity,
      bio: p.bio,
    }))
    cache = products
    cacheLoadedAt = Date.now()
    return products
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

// Bewertet, wie gut ein Produktname zu einer Suchanfrage passt (höher =
// besser). Reine Substring-Suche (wie zuvor) ließ z. B. "Milch" beliebige
// Treffer wie "Buttermilch" oder "Milchschokolade" gleichrangig neben
// echten Milch-Produkten erscheinen und – schlimmer noch – nach Preis
// sortiert sogar VOR ihnen stehen. Deutsche Komposita haben keine
// Wortgrenzen (Leerzeichen), daher zählt ein Treffer als eigenständiges
// "Wort" nur, wenn er durch Leerzeichen/Bindestrich abgetrennt ist; ein
// Suffix wie "-zwiebel" in "Frühlingszwiebel" fällt dagegen in die
// niedrigste Kategorie und landet nicht mehr fälschlich ganz oben.
function matchScore(name: string, query: string): number {
  const n = name.toLowerCase()
  const q = query.toLowerCase()
  if (!q) return 0
  if (n === q) return 100
  const words = n.split(/[\s,-]+/)
  if (words[0] === q) return 90
  if (words.includes(q)) return 70
  if (n.startsWith(q)) return 50
  if (n.includes(q)) return 20
  return 0
}

export function searchProducts(
  products: PriceProduct[],
  query: string,
  limit = 40,
): PriceProduct[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return products
    .map((p) => ({ p, score: matchScore(p.name, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.price - b.p.price)
    .slice(0, limit)
    .map((x) => x.p)
}

/** Bester (relevantester, dann günstigster) Treffer für einen Artikelnamen,
 * unabhängig vom Supermarkt. */
export function cheapestMatch(
  products: PriceProduct[],
  itemName: string,
): PriceProduct | null {
  return searchProducts(products, itemName, 1)[0] ?? null
}

/** Bis zu `limit` verschiedene Supermärkte mit ihrem jeweils relevantesten
 * (bei Gleichstand günstigsten) Treffer für einen Artikelnamen – Basis für
 * einen Preisvergleich. */
export function cheapestPerStore(
  products: PriceProduct[],
  itemName: string,
  limit = 4,
): PriceProduct[] {
  const q = itemName.trim().toLowerCase()
  if (!q) return []
  const bestPerStore = new Map<string, { product: PriceProduct; score: number }>()
  for (const p of products) {
    const score = matchScore(p.name, q)
    if (score <= 0) continue
    const existing = bestPerStore.get(p.store)
    if (
      !existing ||
      score > existing.score ||
      (score === existing.score && p.price < existing.product.price)
    ) {
      bestPerStore.set(p.store, { product: p, score })
    }
  }
  return [...bestPerStore.values()]
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
    .slice(0, limit)
    .map((x) => x.product)
}
