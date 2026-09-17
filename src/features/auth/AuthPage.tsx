import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Button, Card } from '../../components/ui'

type Mode = 'signin' | 'signup'

/**
 * Einfacher E-Mail+Passwort-Login/Registrierung über Supabase Auth. Wird
 * angezeigt, solange keine Sitzung besteht (siehe App.tsx).
 */
export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (err) setError(err.message)
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
        })
        if (err) {
          setError(err.message)
        } else {
          setInfo(
            'Konto erstellt! Falls in deinem Supabase-Projekt "Confirm email" aktiv ist, bestätige zuerst die E-Mail, die dir gerade zugeschickt wurde – ansonsten bist du direkt angemeldet.',
          )
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-emerald-700">
          StudiKoch
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {mode === 'signin' ? 'Melde dich an.' : 'Konto erstellen – kostenlos.'}
        </p>
      </div>

      <Card padded={false} className="p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm text-stone-700">
            E-Mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <label className="block text-sm text-stone-700">
            Passwort
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-emerald-700">{info}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? 'Bitte warten …'
              : mode === 'signin'
                ? 'Anmelden'
                : 'Konto erstellen'}
          </Button>
        </form>
      </Card>

      <button
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError(null)
          setInfo(null)
        }}
        className="text-sm text-emerald-700 underline"
      >
        {mode === 'signin'
          ? 'Noch kein Konto? Registrieren'
          : 'Schon ein Konto? Anmelden'}
      </button>
    </div>
  )
}
