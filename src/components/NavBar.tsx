import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthProvider'

// Jeder Eintrag entspricht einem der Hauptbereiche der App.
// "to" ist der Pfad, "label" der sichtbare Text in der Navigation.
// Icons stimmen mit den PageHeader-Icons der jeweiligen Seite überein
// (siehe components/ui.tsx SectionTone) – schnelleres Wiedererkennen beim
// Überfliegen der Navigation, ohne dass jeder Bereich eine eigene
// Akzentfarbe für Buttons/aktive Zustände bräuchte.
const links = [
  { to: '/', label: 'Start', icon: '🏠' },
  { to: '/utensilien', label: 'Utensilien & Zutaten', icon: '🧺' },
  { to: '/einkaufsliste', label: 'Einkaufsliste', icon: '🛒' },
  { to: '/rezepte', label: 'Rezepte', icon: '🍳' },
  { to: '/wochenplan', label: 'Wochenplan', icon: '🗓️' },
]

// Dunkle Leiste statt der bisherigen fast-weißen – dient als sichtbarer,
// gleichbleibender "Rahmen" der App und liefert den Hauptteil des
// gewünschten dunkleren/kontrastreicheren Gesamteindrucks, ohne dass jede
// einzelne Seite dafür umgebaut werden muss.
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-emerald-600 text-white'
      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-white'
  }`

export default function NavBar() {
  const { session } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Menü nach jedem Seitenwechsel automatisch schließen, sonst bleibt es auf
  // dem Handy/Tablet nach dem Antippen eines Links offen stehen.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <nav className="sticky top-0 z-20 border-b border-stone-100 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-4 py-3">
        <Link
          to="/"
          className="mr-2 flex-1 text-lg font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400 transition-colors hover:text-emerald-800 dark:hover:text-emerald-300 lg:flex-none"
        >
          🍲 StudiKoch
        </Link>

        {/* Ab "lg" (Tablet quer/Desktop) genug Platz für alle Links in einer
            Zeile – darunter (Handy und Tablet hochkant) ein Hamburger-Menü,
            damit die Navigation nicht mehr in mehrere unübersichtliche
            Zeilen umbricht. */}
        <div className="hidden flex-1 items-center gap-1 lg:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={linkClass}
            >
              {link.icon} {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {session?.user.email && (
            <span className="hidden text-xs text-stone-500 dark:text-stone-400 xl:inline">
              {session.user.email}
            </span>
          )}
          <NavLink
            to="/einstellungen"
            aria-label="Einstellungen"
            className={({ isActive }) =>
              `rounded-xl p-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-white'
              }`
            }
          >
            ⚙️
          </NavLink>
          <button
            onClick={() => supabase?.auth.signOut()}
            className="rounded-xl px-3 py-1.5 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-white"
          >
            Abmelden
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
          className="rounded-xl p-2 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-white lg:hidden"
        >
          {menuOpen ? (
            <span className="block text-xl leading-none">✕</span>
          ) : (
            <span className="block space-y-1">
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
            </span>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-stone-100 dark:border-stone-800 px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={linkClass}
              >
                {link.icon} {link.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 dark:border-stone-800 pt-3">
            <NavLink
              to="/einstellungen"
              end
              className="shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-white"
            >
              ⚙️ Einstellungen
            </NavLink>
            <button
              onClick={() => supabase?.auth.signOut()}
              className="shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-white"
            >
              Abmelden
            </button>
          </div>
          {session?.user.email && (
            <p className="mt-2 truncate text-xs text-stone-500 dark:text-stone-400">
              {session.user.email}
            </p>
          )}
        </div>
      )}
    </nav>
  )
}
