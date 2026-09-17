// Ordnet die (englischen) Geräte-/Utensil-Namen, die Spoonacular pro
// Zubereitungsschritt mitliefert, deutschen Labels zu – zum einen für die
// Anzeige ("was brauche ich dafür"), zum anderen um zu prüfen, ob ein
// Rezept mit dem eigenen Inventar (Utensilien/Öfen, siehe Inventory-
// Feature) überhaupt kochbar ist.
//
// "critical" markiert Geräte, die nicht jeder besitzt (z. B. Backofen,
// Mikrowelle, Mixer) – nur diese fließen in die Kochbarkeits-Prüfung ein.
// Alltägliche Utensilien (Topf, Pfanne, Messer, Schüssel, …) werden nur
// zur Info angezeigt und gelten immer als vorhanden, da so gut wie jeder
// Haushalt sie hat und TheMealDB/Spoonacular sie fast überall auflisten
// würde, was die Prüfung sonst unbrauchbar machen würde.
interface EquipmentRule {
  en: RegExp
  de: string
  critical: boolean
}

const EQUIPMENT_RULES: EquipmentRule[] = [
  // Geräte, die wir für die "kann ich kochen?"-Prüfung berücksichtigen.
  { en: /\boven\b/i, de: 'Backofen', critical: true },
  { en: /stove|stovetop|\bhob\b/i, de: 'Herd', critical: true },
  { en: /microwave/i, de: 'Mikrowelle', critical: true },
  { en: /blender/i, de: 'Mixer', critical: true },
  { en: /food processor/i, de: 'Küchenmaschine', critical: true },
  { en: /toaster/i, de: 'Toaster', critical: true },
  { en: /grill|barbecue|\bbbq\b/i, de: 'Grill', critical: true },
  { en: /slow cooker|crock ?pot/i, de: 'Slow Cooker', critical: true },
  { en: /rice cooker/i, de: 'Reiskocher', critical: true },
  { en: /deep fryer/i, de: 'Fritteuse', critical: true },
  { en: /air fryer/i, de: 'Heißluftfritteuse', critical: true },
  { en: /waffle iron/i, de: 'Waffeleisen', critical: true },
  { en: /pressure cooker/i, de: 'Schnellkochtopf', critical: true },
  { en: /stand mixer|hand mixer/i, de: 'Handrührgerät', critical: true },
  { en: /kettle/i, de: 'Wasserkocher', critical: true },
  { en: /coffee maker|espresso machine/i, de: 'Kaffeemaschine', critical: true },
  // Alltägliche Utensilien – nur zur Anzeige, keine Kochbarkeits-Prüfung.
  { en: /frying pan|skillet/i, de: 'Pfanne', critical: false },
  { en: /sauce ?pan|\bpot\b/i, de: 'Topf', critical: false },
  { en: /knife/i, de: 'Kochmesser', critical: false },
  { en: /cutting board/i, de: 'Schneidebrett', critical: false },
  { en: /\bbowl\b/i, de: 'Schüssel', critical: false },
  { en: /whisk/i, de: 'Schneebesen', critical: false },
  { en: /spatula/i, de: 'Pfannenwender', critical: false },
  { en: /grater/i, de: 'Reibe', critical: false },
  { en: /ladle/i, de: 'Schöpfkelle', critical: false },
  { en: /measuring cup|measuring spoon/i, de: 'Messbecher', critical: false },
  {
    en: /baking sheet|baking pan|baking dish|casserole dish/i,
    de: 'Backblech/Auflaufform',
    critical: false,
  },
  { en: /peeler/i, de: 'Sparschäler', critical: false },
  { en: /colander|sieve|strainer/i, de: 'Sieb', critical: false },
  { en: /kitchen scale/i, de: 'Küchenwaage', critical: false },
]

export interface RequiredEquipment {
  label: string
  critical: boolean
}

export function extractRequiredEquipment(
  rawNames: string[],
): RequiredEquipment[] {
  const found = new Map<string, boolean>()
  for (const raw of rawNames) {
    for (const rule of EQUIPMENT_RULES) {
      if (rule.en.test(raw)) {
        found.set(rule.de, rule.critical || found.get(rule.de) === true)
      }
    }
  }
  return [...found.entries()].map(([label, critical]) => ({
    label,
    critical,
  }))
}

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

function isOwned(label: string, owned: string[]): boolean {
  // "Backblech/Auflaufform" etc.: Besitz von einer der Alternativen reicht.
  const alternatives = normalize(label).split('/')
  return owned.some((name) => {
    const n = normalize(name)
    return alternatives.some((alt) => n.includes(alt) || alt.includes(n))
  })
}

/**
 * Prüft, ob ein Rezept mit dem vorhandenen Inventar (Utensilien + Öfen/
 * Herde zusammen) kochbar ist. Nur "kritische" Geräte zählen – alltägliche
 * Utensilien werden als immer vorhanden angenommen.
 */
export function canCookWithInventory(
  equipment: RequiredEquipment[],
  owned: string[],
): boolean {
  const critical = equipment.filter((e) => e.critical)
  if (critical.length === 0) return true
  return critical.every((e) => isOwned(e.label, owned))
}

export function missingEquipment(
  equipment: RequiredEquipment[],
  owned: string[],
): RequiredEquipment[] {
  return equipment.filter((e) => e.critical && !isOwned(e.label, owned))
}
