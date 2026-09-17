import { useEffect, useState } from 'react'
import { subscribeUndoToast, type UndoState } from '../lib/undoToast'

// Einmal in App.tsx gerendert – zeigt kurz "<Aktion> – Rückgängig" nach
// jedem Hinzufügen/Entfernen in Inventar, Einkaufsliste oder Rezepten
// (siehe lib/undoToast.ts für die Auslöse-Seite).
export default function UndoToast() {
  const [state, setState] = useState<UndoState | null>(null)

  useEffect(() => subscribeUndoToast(setState), [])

  if (!state) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg shadow-stone-950/30">
        <span>{state.message}</span>
        <button
          onClick={state.onUndo}
          className="font-semibold text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
        >
          Rückgängig
        </button>
      </div>
    </div>
  )
}
