import { useNavigate } from 'react-router'
import RecipeSwiper from './RecipeSwiper'
import { QuickLinkCard } from '../../components/ui'

// Startseite als kleiner "Hub": statt nur des Rezepte-Tinders auch
// Schnellzugriffe auf die Funktionen, die inhaltlich am engsten mit "was
// koche ich heute" zusammenhängen (Inventar-basierte Vorschläge, bald
// ablaufende Zutaten, Wochenplan, Barcode-Scan) – die Funktionen bleiben
// jeweils eigenständige Seiten, überschneiden sich hier aber bewusst als
// Einstiegspunkte, statt dass man sie erst in tief verschachtelten Reitern
// finden muss.
export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Willkommen bei StudiKoch
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Rezepte entdecken, Einkaufsliste füllen, Budget im Blick behalten.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QuickLinkCard
          icon="🥘"
          title="Was kann ich kochen?"
          description="Rezepte nur aus deinem Inventar"
          onClick={() =>
            navigate('/rezepte', { state: { mode: 'inventory' } })
          }
        />
        <QuickLinkCard
          icon="⏳"
          title="Was muss weg?"
          description="Bald ablaufende Zutaten verwerten"
          onClick={() => navigate('/rezepte', { state: { mode: 'useitup' } })}
        />
        <QuickLinkCard
          icon="🗓️"
          title="Wochenplan"
          description="Menü & Budget für die ganze Woche"
          onClick={() => navigate('/wochenplan')}
        />
        <QuickLinkCard
          icon="📷"
          title="Barcode scannen"
          description="Produkt direkt ins Inventar aufnehmen"
          onClick={() =>
            navigate('/utensilien', {
              state: { tab: 'zutaten', autoScan: true },
            })
          }
        />
      </div>

      <RecipeSwiper />
    </div>
  )
}
