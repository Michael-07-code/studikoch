import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Wiederverwendbare UI-Bausteine für einen einheitlichen, modernen Look in
// der ganzen App (Karten, Buttons, Seitenkopf, Leerzustand, Badge). Ersetzt
// die bisher pro Seite wiederholten Tailwind-Klassenketten, damit sich ein
// Stil-Update künftig an einer Stelle machen lässt.

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            {description}
          </p>
        )}
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
      className={`rounded-2xl border border-stone-300/80 bg-white shadow-card ${
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
    'bg-emerald-700 text-white shadow-sm shadow-emerald-950/25 hover:bg-emerald-800 hover:shadow-md hover:shadow-emerald-950/30 disabled:hover:bg-emerald-700 disabled:shadow-none',
  secondary:
    'bg-emerald-100 text-emerald-900 border border-emerald-200 hover:bg-emerald-200 disabled:hover:bg-emerald-100',
  outline:
    'border-2 border-emerald-700 text-emerald-800 hover:bg-emerald-50 disabled:hover:bg-transparent',
  ghost: 'text-stone-600 hover:bg-stone-100 disabled:hover:bg-transparent',
  danger: 'text-red-700 hover:bg-red-50 disabled:hover:bg-transparent',
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
    neutral: 'bg-stone-200 text-stone-700',
    brand: 'bg-emerald-100 text-emerald-900',
    warning: 'bg-amber-100 text-amber-900',
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
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-stone-500">
      {children}
    </div>
  )
}

// Kleine, unaufdringliche Infozeile für Hinweise, die früher als lange
// Fließtext-Absätze auf jeder Seite standen (siehe Nutzerwunsch "unnötige
// Texterklärungen entfernen") – ein Satz statt eines Absatzes.
export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-stone-400">{children}</p>
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
    <div className="flex gap-1 overflow-x-auto border-b border-stone-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`shrink-0 whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
            active === t.id
              ? 'border-b-2 border-emerald-700 text-emerald-800'
              : 'text-stone-500 hover:text-stone-700'
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
      className="flex items-start gap-3 rounded-2xl border border-stone-200/70 bg-white p-3 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:translate-y-0"
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-stone-900">{title}</span>
        <span className="block text-xs text-stone-500">{description}</span>
      </span>
    </button>
  )
}
