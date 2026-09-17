// Es gibt keine offizielle, kostenlose API für Live-Preise bei SPAR, Rewe,
// Edeka & Co. (nur inoffizielle, meist kostenpflichtige Scraper-Dienste
// zweifelhafter Rechtslage – darauf bauen wir bewusst nicht auf). Stattdessen
// merkt sich StudiKoch die Preise, die der Nutzer selbst beim Eintragen
// eines Artikels angibt, je Artikel + Supermarkt. So entsteht mit der Zeit
// ein eigenes kleines Preisbuch, aus dem sich "günstiger bei X"-Hinweise
// ableiten lassen – ohne jede externe Datenquelle.
export interface PriceEntry {
  supermarketId: string
  price: number
  updatedAt: string
}

// Name -> bekannte Preise in verschiedenen Supermärkten.
export type PriceBook = Record<string, PriceEntry[]>

// Normalisiert Artikelnamen für den Abgleich (Groß-/Kleinschreibung,
// Leerraum, Plural-"s" ignorieren wir bewusst nicht – lieber zu wenig als
// falsch zusammenführen).
export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase()
}
