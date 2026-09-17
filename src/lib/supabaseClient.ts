import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function readEnv(name: string): string | null {
  const value = (import.meta.env as Record<string, string | undefined>)[name]
  return value && value.trim() ? value.trim() : null
}

const supabaseUrl = readEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY')

export function hasSupabaseConfig(): boolean {
  return supabaseUrl !== null && supabaseAnonKey !== null
}

// "null", wenn .env.local (noch) keine Supabase-Zugangsdaten enthält – der
// Rest der App zeigt in diesem Fall einen Einrichtungs-Hinweis an, statt
// mit einer kryptischen Fehlermeldung abzustürzen (siehe App.tsx).
export const supabase: SupabaseClient | null = hasSupabaseConfig()
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null
