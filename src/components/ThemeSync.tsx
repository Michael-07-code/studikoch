import { useEffect } from 'react'
import { useAppSettings } from '../lib/useAppSettings'
import { applyTheme } from '../lib/theme'

// Wendet die gespeicherte Hell/Dunkel-Einstellung auf <html> an, sobald sie
// aus Supabase geladen ist – rendert selbst nichts. Die sofortige erste
// Anwendung (ohne auf Supabase zu warten) übernimmt lib/theme.ts direkt
// beim Start in main.tsx anhand des lokal zwischengespeicherten Werts;
// dieser Abgleich hier korrigiert das nur noch, falls die geräteübergreifend
// gespeicherte Einstellung vom lokalen Zwischenspeicher abweicht (z. B. neu
// angemeldetes Gerät).
export default function ThemeSync() {
  const { appSettings, loading } = useAppSettings()

  useEffect(() => {
    if (!loading) applyTheme(appSettings.theme)
  }, [loading, appSettings.theme])

  return null
}
