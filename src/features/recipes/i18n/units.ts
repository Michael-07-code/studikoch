// Übersetzung gängiger Maßeinheiten/Wörter in Mengenangaben. Läuft rein
// lokal (kein API-Aufruf, kein Tageslimit) über Textersetzung. Deckt die
// häufigsten Fälle ab; unbekannte Wörter bleiben unübersetzt stehen, statt
// die Anzeige zu verfälschen.
//
// Reihenfolge: längere/spezifischere Ausdrücke zuerst, damit sie nicht von
// kürzeren Teiltreffern verdeckt werden.
const UNIT_TRANSLATIONS: [pattern: RegExp, replacement: string][] = [
  [/\bto taste\b/gi, 'nach Geschmack'],
  [/\bas needed\b/gi, 'nach Bedarf'],
  [/\bfor garnish\b/gi, 'zum Garnieren'],
  [/\bfor serving\b/gi, 'zum Servieren'],
  [/\btablespoons?\b/gi, 'EL'],
  [/\bteaspoons?\b/gi, 'TL'],
  [/\btbsps?\.?\b/gi, 'EL'],
  [/\btsps?\.?\b/gi, 'TL'],
  [/\bcups?\b/gi, 'Tasse(n)'],
  [/\bounces?\b/gi, 'Unzen'],
  [/\bpounds?\b/gi, 'Pfund'],
  [/\blbs?\.?\b/gi, 'Pfund'],
  [/\bpinch(es)?\b/gi, 'Prise(n)'],
  [/\bcloves?\b/gi, 'Zehe(n)'],
  [/\bslices?\b/gi, 'Scheibe(n)'],
  [/\bcans?\b/gi, 'Dose(n)'],
  [/\bpackages?\b/gi, 'Packung(en)'],
  [/\bpkgs?\.?\b/gi, 'Packung(en)'],
  [/\bhandfuls?\b/gi, 'Handvoll'],
  [/\bbunch(es)?\b/gi, 'Bund'],
  [/\bsprigs?\b/gi, 'Zweig(e)'],
  [/\bpieces?\b/gi, 'Stück'],
  [/\bwhole\b/gi, 'ganze(s)'],
  [/\bsmall\b/gi, 'klein'],
  [/\bmedium\b/gi, 'mittel'],
  [/\blarge\b/gi, 'groß'],
  [/\bchopped\b/gi, 'gehackt'],
  [/\bsliced\b/gi, 'in Scheiben'],
  [/\bdiced\b/gi, 'gewürfelt'],
  [/\bminced\b/gi, 'fein gehackt'],
  [/\bgrated\b/gi, 'gerieben'],
  [/\bpeeled\b/gi, 'geschält'],
  [/\bfresh\b/gi, 'frisch'],
  [/\bdried\b/gi, 'getrocknet'],
]

export function translateUnit(text: string): string {
  let result = text
  for (const [pattern, replacement] of UNIT_TRANSLATIONS) {
    result = result.replace(pattern, replacement)
  }
  return result
}
