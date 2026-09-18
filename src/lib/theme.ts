export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'studikoch-theme'

// Sofort beim Start angewendet (siehe main.tsx), damit die Seite nicht kurz
// im falschen Modus aufblitzt, während die eigentliche Einstellung noch aus
// Supabase geladen wird (das dauert einen Moment, localStorage ist sofort
// da). Supabase bleibt die geräteübergreifende "Wahrheit" – localStorage ist
// nur ein schneller lokaler Zwischenspeicher, der bei jeder Änderung
// mitaktualisiert wird (siehe applyTheme).
export function getCachedTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // z. B. privater Browser-Modus – dann bleibt nur die Klasse gesetzt.
  }
}
