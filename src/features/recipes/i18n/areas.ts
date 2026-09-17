import { translateText } from '../../../lib/translate'

// Die häufigsten Küchen/Länder in TheMealDB, von Hand übersetzt. Für alles
// andere (die API kennt deutlich mehr Länder, als in der Praxis in
// Rezepten vorkommen) greifen wir auf die Übersetzungs-API zurück.
const AREA_TRANSLATIONS: Record<string, string> = {
  American: 'Amerikanisch',
  British: 'Britisch',
  Canadian: 'Kanadisch',
  Chinese: 'Chinesisch',
  Croatian: 'Kroatisch',
  Dutch: 'Niederländisch',
  Egyptian: 'Ägyptisch',
  Filipino: 'Philippinisch',
  French: 'Französisch',
  Greek: 'Griechisch',
  Indian: 'Indisch',
  Irish: 'Irisch',
  Italian: 'Italienisch',
  Jamaican: 'Jamaikanisch',
  Japanese: 'Japanisch',
  Kenyan: 'Kenianisch',
  Malaysian: 'Malaysisch',
  Mexican: 'Mexikanisch',
  Moroccan: 'Marokkanisch',
  Polish: 'Polnisch',
  Portuguese: 'Portugiesisch',
  Russian: 'Russisch',
  Spanish: 'Spanisch',
  Thai: 'Thailändisch',
  Tunisian: 'Tunesisch',
  Turkish: 'Türkisch',
  Ukrainian: 'Ukrainisch',
  Uruguayan: 'Uruguayisch',
  Vietnamese: 'Vietnamesisch',
  German: 'Deutsch',
  Unknown: 'Unbekannt',
}

export async function translateArea(area: string): Promise<string> {
  if (!area) return area
  return AREA_TRANSLATIONS[area] ?? (await translateText(area))
}
