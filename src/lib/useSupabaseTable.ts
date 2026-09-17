import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthProvider'

interface Row {
  id: string
}

/**
 * Generischer Hook für einfache, pro-Nutzer-Listen-Tabellen in Supabase
 * (Utensilien, Öfen/Herde, Zutaten, Supermärkte, Einkaufsliste, eigene
 * Rezeptlisten, gespeicherte Rezepte). Lädt beim Login einmal alle Zeilen
 * und hält sie danach lokal im State – insert/update/remove aktualisieren
 * sowohl die Datenbank als auch sofort den lokalen State (optimistisch),
 * damit sich die App weiterhin so reaktionsschnell wie vorher mit
 * localStorage anfühlt.
 */
export function useSupabaseTable<T extends Row>(
  table: string,
  orderBy = 'created_at',
) {
  const { session } = useAuth()
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!supabase || !session) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from(table)
      .select('*')
      .eq('user_id', session.user.id)
      .order(orderBy, { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else setRows((data ?? []) as T[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, table])

  const insert = useCallback(
    async (row: Record<string, unknown>): Promise<T | null> => {
      if (!supabase || !session) return null
      const { data, error: err } = await supabase
        .from(table)
        .insert({ ...row, user_id: session.user.id })
        .select()
        .single()
      if (err) {
        setError(err.message)
        return null
      }
      setRows((prev) => [...prev, data as T])
      return data as T
    },
    [table, session],
  )

  const insertMany = useCallback(
    async (newRows: Record<string, unknown>[]): Promise<T[]> => {
      if (!supabase || !session || newRows.length === 0) return []
      const { data, error: err } = await supabase
        .from(table)
        .insert(newRows.map((r) => ({ ...r, user_id: session.user.id })))
        .select()
      if (err) {
        setError(err.message)
        return []
      }
      setRows((prev) => [...prev, ...(data as T[])])
      return data as T[]
    },
    [table, session],
  )

  const update = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      if (!supabase) return
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      )
      const { error: err } = await supabase
        .from(table)
        .update(patch)
        .eq('id', id)
      if (err) setError(err.message)
    },
    [table],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!supabase) return
      setRows((prev) => prev.filter((r) => r.id !== id))
      const { error: err } = await supabase.from(table).delete().eq('id', id)
      if (err) setError(err.message)
    },
    [table],
  )

  return { rows, setRows, insert, insertMany, update, remove, loading, error }
}
