import { useAppSettings } from '../../lib/useAppSettings'
import { Card, Hint, PageHeader } from '../../components/ui'

// Kleine, zentrale Stelle für App-weite Verhaltens-Einstellungen (bisher
// nirgends unterzubringen, da sie kein einzelnes Feature betreffen). Der
// bevorzugte Supermarkt für die Einkaufsliste liegt dagegen direkt im
// Reiter "Supermärkte" der Einkaufsliste, da er dort inhaltlich hingehört.
export default function SettingsPage() {
  const { appSettings, updateAppSettings, loading } = useAppSettings()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einstellungen"
        description="Verhalten der App an deine Gewohnheiten anpassen."
        icon="⚙️"
        tone="neutral"
      />

      <Card className="space-y-3">
        <span className="block text-sm font-medium text-stone-900 dark:text-stone-100">
          Darstellung
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => updateAppSettings({ theme: 'light' })}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              appSettings.theme === 'light'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'border-stone-200 text-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            ☀️ Hell
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => updateAppSettings({ theme: 'dark' })}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              appSettings.theme === 'dark'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'border-stone-200 text-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            🌙 Dunkel
          </button>
        </div>
      </Card>

      <Card className="space-y-2">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={appSettings.askMealTypeOnSave}
            disabled={loading}
            onChange={(e) =>
              updateAppSettings({ askMealTypeOnSave: e.target.checked })
            }
            className="mt-0.5 size-4 rounded border-stone-200 dark:border-stone-700 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            <span className="block text-sm font-medium text-stone-900 dark:text-stone-100">
              Beim Speichern eines Rezepts nach der Mahlzeit fragen
            </span>
            <span className="block text-sm text-stone-500 dark:text-stone-400">
              Frühstück oder Mittag-/Abendessen direkt beim Speichern
              festlegen. Ausgeschaltet: Rezepte werden ohne Nachfrage als
              „Sonstiges" gespeichert, du kannst die Mahlzeit später jederzeit
              unter „Meine Rezepte" nachtragen.
            </span>
          </span>
        </label>
        <Hint>
          Mittag- und Abendessen sind nur noch eine einzige Kategorie
          „Mittag-/Abendessen" – die App unterscheidet sie an keiner Stelle
          mehr.
        </Hint>
      </Card>
    </div>
  )
}
