// TheMealDB liefert keine Portionsangabe zu seinen Rezepten. Als übliche
// Annahme gehen wir von BASE_SERVINGS Portionen pro Rezept aus und
// skalieren Mengenangaben proportional zur gewünschten Personenzahl.
export const BASE_SERVINGS = 4

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
}

export function parseLeadingNumber(
  text: string,
): { value: number; rest: string } | null {
  const trimmed = text.trim()

  // z. B. "1/2 TL"
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)(.*)$/)
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10)
    const den = parseInt(fractionMatch[2], 10)
    return { value: num / den, rest: fractionMatch[3] }
  }

  // z. B. "200g", "1.5 l", "2 EL"
  const decimalMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)(.*)$/)
  if (decimalMatch) {
    return {
      value: parseFloat(decimalMatch[1].replace(',', '.')),
      rest: decimalMatch[2],
    }
  }

  // z. B. "½ Zwiebel"
  for (const [symbol, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (trimmed.startsWith(symbol)) {
      return { value: val, rest: trimmed.slice(symbol.length) }
    }
  }

  return null
}

function formatNumber(value: number): string {
  // Auf 2 Nachkommastellen runden (z. B. "1.33") – für eine Kochapp
  // präzise genug, ohne krumme Nachkommastellen anzuzeigen.
  const rounded = Math.round(value * 100) / 100
  return String(rounded)
}

/**
 * Versucht, eine führende Zahl in der Mengenangabe zu erkennen und
 * proportional auf die gewünschte Personenzahl umzurechnen. Mengen ohne
 * erkennbare Zahl (z. B. "to taste") werden unverändert (aber ggf. über
 * transformUnit übersetzt) zurückgegeben.
 *
 * transformUnit wird auf den Text-Anteil (Einheit/Wort) angewendet, z. B.
 * um "cup" zu "Tasse(n)" zu übersetzen, ohne die Zahl anzufassen.
 */
export function scaleMeasure(
  measure: string,
  servings: number,
  transformUnit: (rest: string) => string = (rest) => rest,
): string {
  if (!measure.trim()) return measure

  const parsed = parseLeadingNumber(measure)
  if (!parsed) return transformUnit(measure)

  const scaled = (parsed.value * servings) / BASE_SERVINGS
  return `${formatNumber(scaled)}${transformUnit(parsed.rest)}`
}
