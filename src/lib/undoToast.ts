// Kleiner, app-weiter "Rückgängig"-Mechanismus: ein einfacher Pub/Sub statt
// React-Context, damit jeder Hook (useInventory, useShoppingList,
// useSavedRecipes, …), der etwas hinzufügt/entfernt, direkt eine kurze
// Rückgängig-Leiste auslösen kann, ohne selbst UI-Zustand verwalten zu
// müssen. Genau ein <UndoToast/> wird einmal in App.tsx gerendert und
// abonniert das hier.
export interface UndoState {
  message: string
  onUndo: () => void
}

type Listener = (state: UndoState | null) => void

let listener: Listener | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

export function subscribeUndoToast(l: Listener): () => void {
  listener = l
  return () => {
    if (listener === l) listener = null
  }
}

// Zeigt für ein paar Sekunden eine Leiste "<message> – Rückgängig". Ein
// neuer Aufruf (z. B. schnell hintereinander mehrere Zutaten hinzugefügt)
// ersetzt die vorherige Leiste, statt sie zu stapeln – bewusst einfach
// gehalten für eine App mit einem Nutzer.
export function showUndo(message: string, onUndo: () => void): void {
  if (hideTimer) clearTimeout(hideTimer)
  listener?.({
    message,
    onUndo: () => {
      onUndo()
      hideUndo()
    },
  })
  hideTimer = setTimeout(hideUndo, 6000)
}

function hideUndo(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  listener?.(null)
}
