import { useEffect, useState } from 'react'

/**
 * Wie React.useState, speichert den Wert aber zusätzlich im
 * Browser-localStorage, sodass er beim nächsten Öffnen der App
 * erhalten bleibt (pro Gerät/Browser, nicht geräteübergreifend).
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initialValue
    } catch {
      // z. B. im privaten Modus des Browsers nicht verfügbar
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Speicher voll oder nicht verfügbar – App funktioniert trotzdem weiter,
      // nur ohne dauerhafte Speicherung.
    }
  }, [key, value])

  return [value, setValue] as const
}
