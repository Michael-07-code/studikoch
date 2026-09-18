import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, getCachedTheme } from './lib/theme'

// Sofort anwenden, noch vor dem ersten Render – sonst blitzt die Seite kurz
// im falschen Modus auf, bis die eigentliche Einstellung aus Supabase
// geladen ist (siehe components/ThemeSync.tsx für den Abgleich danach).
applyTheme(getCachedTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
