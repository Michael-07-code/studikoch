// Kostenlose Übersetzung Englisch → Deutsch über die MyMemory-API
// (https://mymemory.translated.net), kein Konto/API-Key nötig.
//
// Wichtige Einschränkung: Die kostenlose, anonyme Nutzung ist auf ca.
// 5000 Zeichen pro Tag begrenzt. Ergebnisse werden deshalb im Browser
// zwischengespeichert (localStorage), damit derselbe Text nicht mehrfach
// übersetzt werden muss. Schlägt eine Übersetzung fehl oder ist das
// Tageslimit erreicht, wird einfach der englische Originaltext angezeigt,
// statt die App zu blockieren.

const CACHE_PREFIX = 'studikoch:translate:en-de:'

function readCache(text: string): string | null {
  try {
    return window.localStorage.getItem(CACHE_PREFIX + text)
  } catch {
    return null
  }
}

function writeCache(text: string, translated: string) {
  try {
    window.localStorage.setItem(CACHE_PREFIX + text, translated)
  } catch {
    // Speicher voll o. Ä. – dann halt ohne Cache, nicht weiter schlimm.
  }
}

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string
  }
}

export async function translateText(text: string): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return text

  const cached = readCache(trimmed)
  if (cached) return cached

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      trimmed,
    )}&langpair=en|de`
    const res = await fetch(url)
    if (!res.ok) return text

    const data = (await res.json()) as MyMemoryResponse
    const translated = data.responseData?.translatedText

    // Bei überschrittenem Tageslimit liefert MyMemory eine Warnung als
    // "Übersetzung" zurück statt eines Fehlers – das fangen wir hier ab.
    if (!translated || translated.toUpperCase().includes('MYMEMORY WARNING')) {
      return text
    }

    writeCache(trimmed, translated)
    return translated
  } catch {
    return text
  }
}

/**
 * Übersetzt mehrere kurze Texte (z. B. die Zutatennamen eines Rezepts).
 * Jeder Text wird einzeln gecacht.
 */
export async function translateMany(texts: string[]): Promise<string[]> {
  return Promise.all(texts.map((t) => translateText(t)))
}
