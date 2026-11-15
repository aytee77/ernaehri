import type { Ingredient } from "../migusto/types";
import type { MigrosProduct } from "./types";

const STOP_WORDS = new Set([
  "migros",
  "classic",
  "budget",
  "bio",
  "valflora",
  "lacroix",
  "jura",
  "sel",
  "natürlich",
  "frisch",
  "und",
  "oder",
  "der",
  "die",
  "das",
  "nach",
  "belieben",
  "für",
  "zum",
  "aus",
  "dem",
  "mit",
  "vom",
  "geschnitten",
  "gerieben",
  "ganze",
  "ganzer",
  "ganzes",
]);

export function normalizeTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("é", "e")
    .replaceAll("è", "e")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/** Similarity between an ingredient name and a product name (0 … 1.x). */
export function matchScore(ingredientName: string, product: MigrosProduct): number {
  const variants = ingredientVariants(ingredientName);
  let best = 0;
  for (const variant of variants) {
    best = Math.max(best, scoreVariant(variant, product));
  }
  return best;
}

/** "Rinds- oder Kalbsragout" is really two options; "Zwiebeln / Schalotten" too. */
function ingredientVariants(name: string): string[] {
  const split = name
    .split(/\s+(?:oder|bzw\.?)\s+|\/|,(?=\s*\w)/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
  return split.length > 1 ? [name, ...split] : [name];
}

function scoreVariant(ingredientName: string, product: MigrosProduct): number {
  const ingredientTokens = normalizeTokens(ingredientName);
  if (ingredientTokens.length === 0) {
    return 0;
  }

  const productTokens = new Set([
    ...normalizeTokens(product.name),
    ...normalizeTokens(product.brand ?? ""),
    ...normalizeTokens(product.leafCategory ?? ""),
  ]);

  let hits = 0;
  let longest = 0;

  for (const token of ingredientTokens) {
    if (productTokens.has(token)) {
      hits += 1;
      longest = Math.max(longest, token.length);
      continue;
    }

    let partial = 0;
    for (const candidate of productTokens) {
      if (candidate.length >= 4 && token.includes(candidate)) {
        partial = Math.max(partial, 0.8);
        longest = Math.max(longest, candidate.length);
      } else if (token.length >= 4 && candidate.includes(token)) {
        partial = Math.max(partial, 0.8);
        longest = Math.max(longest, token.length);
      } else if (token.length >= 5 && candidate.length >= 5 && token.slice(0, 5) === candidate.slice(0, 5)) {
        partial = Math.max(partial, 0.6);
      }
    }
    hits += partial;
  }

  const coverage = hits / ingredientTokens.length;
  const bonus = longest >= 6 ? 0.15 : 0;
  return coverage + bonus;
}

const MIN_SCORE = 0.4;
export const MATCH_MIN_SCORE = MIN_SCORE;

export interface IngredientMatch {
  ingredient: Ingredient;
  product: MigrosProduct | null;
  score: number;
}

/**
 * Greedy many-to-one matching: every product is used at most once, and only
 * matches above `MIN_SCORE` are kept. Perfect matches are resolved first.
 */
export function matchIngredients(ingredients: Ingredient[], products: MigrosProduct[]): IngredientMatch[] {
  const available = new Set(products.map((product) => product.uid));

  const scored = ingredients
    .map((ingredient) => {
      let best: { product: MigrosProduct; score: number } | null = null;
      for (const product of products) {
        const score = matchScore(ingredient.name, product);
        if (score >= MIN_SCORE && (!best || score > best.score)) {
          best = { product, score };
        }
      }
      return { ingredient, best };
    })
    .sort((a, b) => (b.best?.score ?? 0) - (a.best?.score ?? 0));

  const result: IngredientMatch[] = [];
  for (const entry of scored) {
    const candidate = entry.best;
    const product = candidate && available.has(candidate.product.uid) ? candidate.product : null;
    if (product) {
      available.delete(product.uid);
    }
    result.push({
      ingredient: entry.ingredient,
      product,
      score: product && candidate ? candidate.score : 0,
    });
  }

  // keep the original ingredient order for display
  const order = new Map(ingredients.map((ingredient, index) => [ingredient.key + ingredient.name, index]));
  return result.sort(
    (a, b) =>
      (order.get(a.ingredient.key + a.ingredient.name) ?? 0) - (order.get(b.ingredient.key + b.ingredient.name) ?? 0),
  );
}

/** Products Migusto links to a recipe but that no ingredient matched. */
export function unmatchedProducts(matches: IngredientMatch[], products: MigrosProduct[]): MigrosProduct[] {
  const used = new Set(matches.map((match) => match.product?.uid).filter(Boolean));
  return products.filter((product) => !used.has(product.uid));
}
