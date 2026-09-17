// Grobe Kategorisierung nach Supermarkt-Gängen, damit die Einkaufsliste in
// etwa so sortiert ist, wie man durch den Laden läuft. Das ist eine
// Heuristik auf Basis von Stichwörtern im (deutschen) Artikelnamen – keine
// exakte Wissenschaft, aber deutlich hilfreicher als eine unsortierte
// Liste. Nutzer können die Kategorie beim Hinzufügen manuell überschreiben.
export type ItemCategory =
  | 'obst-gemuese'
  | 'brot-backwaren'
  | 'milchprodukte-eier'
  | 'fleisch-fisch'
  | 'tiefkuehl'
  | 'trockenwaren-konserven'
  | 'gewuerze-backzutaten'
  | 'getraenke'
  | 'suesses-snacks'
  | 'drogerie-haushalt'
  | 'sonstiges'

// Reihenfolge = angenommener Rundgang durch den Supermarkt.
export const CATEGORY_ORDER: ItemCategory[] = [
  'obst-gemuese',
  'brot-backwaren',
  'milchprodukte-eier',
  'fleisch-fisch',
  'tiefkuehl',
  'trockenwaren-konserven',
  'gewuerze-backzutaten',
  'getraenke',
  'suesses-snacks',
  'drogerie-haushalt',
  'sonstiges',
]

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  'obst-gemuese': 'Obst & Gemüse',
  'brot-backwaren': 'Brot & Backwaren',
  'milchprodukte-eier': 'Milchprodukte & Eier',
  'fleisch-fisch': 'Fleisch, Wurst & Fisch',
  tiefkuehl: 'Tiefkühl',
  'trockenwaren-konserven': 'Trockenwaren & Konserven',
  'gewuerze-backzutaten': 'Gewürze & Backzutaten',
  getraenke: 'Getränke',
  'suesses-snacks': 'Süßes & Snacks',
  'drogerie-haushalt': 'Drogerie & Haushalt',
  sonstiges: 'Sonstiges',
}

// Reihenfolge der Prüfung ist wichtig: spezifischere/eindeutigere
// Stichwörter zuerst, damit z. B. "Tiefkühlpizza" bei Tiefkühl landet und
// nicht bei Brot & Backwaren.
const KEYWORD_RULES: Array<[ItemCategory, RegExp]> = [
  [
    'tiefkuehl',
    /tiefkühl|tiefkuehl|tk[- ]|frost|eis(creme)?\b|gefroren/,
  ],
  [
    'obst-gemuese',
    /apfel|äpfel|banane|orange|zitrone|limette|beere|trauben|birne|mango|avocado|tomate|gurke|paprika|zwiebel|knoblauch|kartoffel|möhre|karotte|salat|spinat|brokkoli|blumenkohl|zucchini|pilz|champignon|kraut|kohl|lauch|sellerie|radieschen|obst|gemüse|kräuter|petersilie|basilikum|koriander|ingwer|chili/,
  ],
  [
    'brot-backwaren',
    /brot|brötchen|toast|baguette|croissant|semmel|wrap|tortilla/,
  ],
  [
    'milchprodukte-eier',
    /milch|joghurt|quark|käse|butter|sahne|ei\b|eier|frischkäse|schmand|mozzarella|parmesan|feta/,
  ],
  [
    'fleisch-fisch',
    /hähnchen|huhn|pute|rind|schwein|hack|wurst|speck|schinken|salami|fisch|lachs|thunfisch|garnele|meeresfrüchte/,
  ],
  [
    'getraenke',
    /wasser|saft|limonade|cola|bier|wein|kaffee|tee\b|energy ?drink/,
  ],
  [
    'suesses-snacks',
    /schokolade|keks|kuchen|chips|gummibär|bonbon|snack|nuss|nüsse|müsliriegel/,
  ],
  [
    'gewuerze-backzutaten',
    /salz|pfeffer|gewürz|öl\b|essig|zucker|mehl|backpulver|hefe|honig|sauce|soße|senf|ketchup|mayonnaise|brühe|reis|nudel|pasta|spaghetti/,
  ],
  [
    'trockenwaren-konserven',
    /dose|konserve|linsen|kichererbsen|bohnen|mais\b|passata|tomatenmark|müsli|haferflocken|cornflakes/,
  ],
  [
    'drogerie-haushalt',
    /toilettenpapier|küchenrolle|spülmittel|waschmittel|zahnpasta|duschgel|shampoo|müllbeutel|batterie|reiniger/,
  ],
]

export function categorizeItem(name: string): ItemCategory {
  const lower = name.toLowerCase()
  for (const [category, pattern] of KEYWORD_RULES) {
    if (pattern.test(lower)) return category
  }
  return 'sonstiges'
}
