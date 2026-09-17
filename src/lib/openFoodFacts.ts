// Kostenlose, kostenlos nutzbare Produktdatenbank ohne API-Key:
// https://world.openfoodfacts.org – liefert zu einem Barcode (EAN/UPC)
// Produktname, Füllmenge und Nährwerte pro 100g/100ml.

export interface OpenFoodFactsProduct {
  name: string
  // Roh von OFF übernommen, z. B. "500 g" oder "1 l" – nicht geparst, da
  // Format uneinheitlich ist.
  quantity?: string
  // Immer pro 100g/100ml, unabhängig von der Packungsgröße.
  nutrimentsPer100g?: {
    caloriesKcal?: number
    proteinG?: number
    carbsG?: number
    fatG?: number
  }
}

interface OpenFoodFactsApiResponse {
  status: number
  product?: {
    product_name?: string
    product_name_de?: string
    quantity?: string
    nutriments?: Record<string, number>
  }
}

export async function lookupBarcode(
  barcode: string,
): Promise<OpenFoodFactsProduct | null> {
  const trimmed = barcode.trim()
  if (!trimmed) return null
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      trimmed,
    )}.json?fields=product_name,product_name_de,quantity,nutriments`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as OpenFoodFactsApiResponse
    if (data.status !== 1 || !data.product) return null

    const p = data.product
    const n = p.nutriments ?? {}
    const name = p.product_name_de || p.product_name
    if (!name) return null

    return {
      name,
      quantity: p.quantity,
      nutrimentsPer100g: {
        caloriesKcal: n['energy-kcal_100g'],
        proteinG: n['proteins_100g'],
        carbsG: n['carbohydrates_100g'],
        fatG: n['fat_100g'],
      },
    }
  } catch {
    return null
  }
}
