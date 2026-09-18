import type { Recipe } from './types'

// Zutaten, die in einem typischen (Studenten-)Haushalt bzw. im normalen
// Supermarkt selten vorhanden, teuer oder schwer zu bekommen sind, sowie
// Meeresfrüchte (explizit unerwünscht laut Nutzerrückmeldung, Beispiel:
// Krabbensalat). Gemeinsame Liste für beide Rezeptquellen (Spoonacular
// nutzt sie zusätzlich serverseitig über "excludeIngredients", TheMealDB
// hat keinen entsprechenden Parameter – dort greift ausschließlich die
// clientseitige Prüfung unten).
export const EXOTIC_OR_FANCY_INGREDIENTS = [
  'truffle',
  'caviar',
  'saffron',
  'foie gras',
  'venison',
  'lobster',
  'duck breast',
  'wagyu',
  'kobe beef',
  'pomegranate molasses',
  'star anise',
  'dragon fruit',
  'goji berries',
  'nori',
  'miso',
  'gochujang',
  'tamarind',
  'sumac',
  'harissa',
  'quail',
  'rabbit',
  'crab',
  'shrimp',
  'prawn',
  'oyster',
  'mussel',
  'clam',
  'scallop',
  'squid',
  'octopus',
  'anchovy',
  'crawfish',
  'escargot',
  'snail',
]

// Grobe Heuristik für "einfach umsetzbar, nichts für Gourmets": wenige
// Zutaten, wenige Zubereitungsschritte, keine der oben gelisteten Zutaten
// im Namen/in der Zutatenliste. Kein Anspruch auf Präzision (das gibt
// weder Spoonacular noch TheMealDB direkt her), aber sortiert typische
// Sterneküche-Rezepte mit 15+ Zutaten und langer Zubereitung zuverlässig
// aus. Bewusst als eigenes Modul, damit dieselbe Prüfung sowohl für
// Spoonacular- als auch für TheMealDB-Ergebnisse gilt – vorher galt der
// Filter nur für Spoonacular, TheMealDB-Vorschläge (z. B. bei
// aufgebrauchtem Spoonacular-Kontingent) waren komplett ungefiltert.
const MAX_SIMPLE_INGREDIENTS = 8
const MAX_SIMPLE_STEPS = 6

export function isStudentFriendly(recipe: Recipe): boolean {
  if (recipe.ingredients.length > MAX_SIMPLE_INGREDIENTS) return false
  if (recipe.instructions.length > MAX_SIMPLE_STEPS) return false

  const haystack = [recipe.name, ...recipe.ingredients.map((i) => i.name)]
    .join(' ')
    .toLowerCase()
  if (EXOTIC_OR_FANCY_INGREDIENTS.some((kw) => haystack.includes(kw))) {
    return false
  }
  return true
}
