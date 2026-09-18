import { useState, type FormEvent } from 'react'
import { Button } from './ui'

interface SimpleItem {
  id: string
  name: string
}

interface Props {
  title: string
  items: SimpleItem[]
  onAdd: (name: string) => void
  onRemove: (id: string) => void
  suggestions: string[]
  placeholder: string
  emptyText: string
  datalistId: string
}

// Wiederverwendbare Liste für einfache "Name-only"-Einträge: wird für
// Utensilien, Öfen/Herde und Supermärkte genutzt.
export default function SimpleItemList({
  title,
  items,
  onAdd,
  onRemove,
  suggestions,
  placeholder,
  emptyText,
  datalistId,
}: Props) {
  const [value, setValue] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{title}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          list={datalistId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <datalist id={datalistId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Button type="submit" className="shrink-0">
          Hinzufügen
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-stone-200 dark:divide-stone-700 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-card">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span>{item.name}</span>
              <button
                onClick={() => onRemove(item.id)}
                className="text-stone-400 dark:text-stone-500 transition-colors hover:text-red-600 dark:hover:text-red-400"
                aria-label={`${item.name} entfernen`}
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
