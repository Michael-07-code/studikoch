import type { ReactNode } from 'react'
import NavBar from './NavBar'
import UndoToast from './UndoToast'
import ThemeSync from './ThemeSync'

// Layout umschließt jede Seite mit der Navigation oben und einem
// einheitlichen Innenabstand für den Inhalt.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <ThemeSync />
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <UndoToast />
    </div>
  )
}
