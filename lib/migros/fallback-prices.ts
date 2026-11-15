/**
 * Rough CHF estimates for common Swiss groceries, used only when the live
 * Migros price API is unreachable so the budget feature still works.
 * Values are typical Migros prices for the smallest pack (November 2026).
 */
const FALLBACK_PRICES: Array<[keyword: string, chf: number]> = [
  ["zwiebel", 1.7],
  ["knoblauch", 1.2],
  ["tomate", 3.95],
  ["peperoni", 4.2],
  ["karotte", 1.5],
  ["kartoffel", 2.4],
  ["lauch", 1.9],
  ["sellerie", 2.2],
  ["zucchini", 2.6],
  ["aubergine", 3.2],
  ["champignon", 4.5],
  ["spinat", 3.2],
  ["broccoli", 2.8],
  ["blumenkohl", 2.9],
  ["hackfleisch", 8.5],
  ["rind", 18.9],
  ["poulet", 12.5],
  ["huhn", 12.5],
  ["schwein", 12.8],
  ["speck", 2.4],
  ["schinken", 5.4],
  ["lamm", 19.5],
  ["lachs", 16.9],
  ["fisch", 14.9],
  ["garnele", 12.9],
  ["ei", 4.6],
  ["milch", 1.5],
  ["rahm", 1.35],
  ["sahne", 3.4],
  ["butter", 3.9],
  ["quark", 2.3],
  ["joghurt", 1.6],
  ["käse", 4.9],
  ["gruyere", 5.6],
  ["mozzarella", 2.9],
  ["parmesan", 5.9],
  ["feta", 3.4],
  ["reis", 2.1],
  ["pasta", 2.4],
  ["teigware", 2.4],
  ["couscous", 2.9],
  ["linsen", 2.5],
  ["kichererbse", 1.9],
  ["bohne", 1.9],
  ["mais", 1.7],
  ["tomatenpüree", 0.8],
  ["kokosmilch", 2.2],
  ["tofu", 4.3],
  ["brot", 3.2],
  ["mehl", 1.4],
  ["zucker", 1.2],
  ["schokolade", 2.2],
  ["nuss", 4.9],
  ["mandel", 5.9],
  ["honig", 5.4],
  ["ahornsirup", 7.9],
  ["wein", 8.9],
  ["fond", 5.95],
  ["bouillon", 4.9],
  ["olivenöl", 12.9],
  ["öl", 9.9],
  ["essig", 2.4],
  ["sojasauce", 4.3],
  ["salz", 1.05],
  ["pfeffer", 2.8],
  ["curry", 3.2],
  ["ingwer", 2.4],
  ["zitrone", 1.1],
  ["apfel", 3.5],
  ["banane", 2.1],
];

const DEFAULT_ESTIMATE_CHF = 3.5;

/** Best-effort CHF estimate for an ingredient that has no live product. */
export function estimatePriceChf(ingredientName: string): { priceChf: number; matched: string | null } {
  const normalized = ingredientName
    .toLowerCase()
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u");

  let best: { priceChf: number; matched: string } | null = null;
  for (const [keyword, price] of FALLBACK_PRICES) {
    if (normalized.includes(keyword) && (!best || keyword.length > best.matched.length)) {
      best = { priceChf: price, matched: keyword };
    }
  }

  return best ? { priceChf: best.priceChf, matched: best.matched } : { priceChf: DEFAULT_ESTIMATE_CHF, matched: null };
}
