import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Wiederverwendbare UI-Bausteine für einen einheitlichen, modernen Look in
// der ganzen App (Karten, Buttons, Seitenkopf, Leerzustand, Badge). Ersetzt
// die bisher pro Seite wiederholten Tailwind-Klassenketten, damit sich ein
// Stil-Update künftig an einer Stelle machen lässt.

// Bereichs-Farbtöne fürs schnelle Wiedererkennen (siehe NavBar): jeder
// Hauptbereich bekommt sein eigenes Icon + einen eigenen, dezenten Farbton
// für PageHeader/Icon-Kreis – NUR zur Orientierung. Die eigentliche
// Aktionsfarbe (Buttons wie "Speichern", "Suchen") bleibt überall Emerald,
// damit "das ist klickbar" nie mit "das ist einfach Bereich X" verwechselt
// wird.
export type SectionTone = 'emerald' | 'amber' | 'sky' | 'violet' | 'neutral'

const SECTION_TONE_CLASSES: Record<SectionTone, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  neutral: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300',
}

export function PageHeader({
  title,
  description,
  action,
  icon,
  tone = 'neutral',
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  tone?: SectionTone
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-lg ${SECTION_TONE_CLASSES[tone]}`}
          >
            {icon}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-stone-500 dark:text-stone-400">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white dark:bg-stone-900 shadow-card ${
        padded ? 'p-4' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

// Kräftigeres, dunkleres Grün als Basis (statt des vorherigen helleren
// Pastell-Emerald), damit Buttons/aktive Zustände deutlich mehr Kontrast
// zur (ebenfalls dunkleren) Umgebung haben. Etwas mehr visuelle Tiefe als
// vorher (Schatten + leichtes Anheben beim Hover, sanftes Eindrücken beim
// Klick), damit Buttons nicht mehr flach/"altmodisch" wirken.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-600 text-white shadow-sm shadow-emerald-950/40 hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-950/50 disabled:hover:bg-emerald-600 disabled:shadow-none',
  secondary:
    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:hover:bg-emerald-900/40',
  outline:
    'border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:hover:bg-transparent',
  ghost: 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:hover:bg-transparent',
  danger: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:hover:bg-transparent',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`rounded-xl font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${
        VARIANT_CLASSES[variant]
      } ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    />
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'brand' | 'warning'
}) {
  const toneClasses = {
    neutral: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300',
    brand: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300',
    warning: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
  }[tone]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses}`}
    >
      {children}
    </span>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-900/60 p-6 text-center text-sm text-stone-500 dark:text-stone-400">
      {children}
    </div>
  )
}

// Kleine, unaufdringliche Infozeile für Hinweise, die früher als lange
// Fließtext-Absätze auf jeder Seite standen (siehe Nutzerwunsch "unnötige
// Texterklärungen entfernen") – ein Satz statt eines Absatzes.
export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-stone-500 dark:text-stone-400">{children}</p>
}

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-stone-200 dark:border-stone-700">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`shrink-0 whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
            active === t.id
              ? 'border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-400'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// Kompakte, "chip"-artige Verlinkung zu einer anderen Funktion der App
// (z. B. auf der Startseite auf "Was kann ich kochen?" oder den
// Wochenplan) – für Querverweise zwischen Funktionen, die sich inhaltlich
// überschneiden, ohne die Navigation weiter aufzublähen.
export function QuickLinkCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 rounded-2xl border border-stone-200/70 dark:border-stone-700/70 bg-white dark:bg-stone-900 p-3 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:translate-y-0"
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</span>
        <span className="block text-xs text-stone-500 dark:text-stone-400">{description}</span>
      </span>
    </button>
  )
}
