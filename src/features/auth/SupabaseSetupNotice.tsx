/**
 * Wird angezeigt, solange VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY nicht in
 * .env.local eingetragen sind (siehe src/lib/supabaseClient.ts).
 */
export default function SupabaseSetupNotice() {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      <h1 className="text-lg font-semibold text-amber-900">
        Supabase ist noch nicht eingerichtet
      </h1>
      <p>
        Damit StudiKoch deine Daten geräteübergreifend speichert, brauchst
        du ein kostenloses Supabase-Projekt:
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Erstelle ein Projekt auf{' '}
          <a
            href="https://supabase.com"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            supabase.com
          </a>{' '}
          (kostenlos, keine Kreditkarte nötig für den Free-Tier).
        </li>
        <li>
          Öffne im Dashboard den <strong>SQL Editor</strong>, füge den
          kompletten Inhalt der Datei <code>supabase/schema.sql</code> aus
          deinem Projektordner ein und klicke auf „Run".
        </li>
        <li>
          Kopiere unter <strong>Project Settings → API</strong> die
          „Project URL" und den „anon public"-Key.
        </li>
        <li>
          Trage beides in deine <code>.env.local</code> ein:{' '}
          <code>VITE_SUPABASE_URL</code> und{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>.
        </li>
        <li>
          Starte den Entwicklungsserver neu (<code>npm run dev</code>), da
          Vite Umgebungsvariablen nur beim Start einliest.
        </li>
      </ol>
      <p className="text-xs text-amber-700">
        Danach kannst du dich mit E-Mail und Passwort registrieren – deine
        Daten sind dann an dein Konto gebunden und auf jedem Gerät
        verfügbar, auf dem du dich anmeldest.
      </p>
    </div>
  )
}
