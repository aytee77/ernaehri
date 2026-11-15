import type { LdJsonRecipe } from "../migusto/flight";
import { extractLdJsonRecipe, formatDuration, normalizeImageUrl, parseIsoDuration } from "../migusto/flight";
import { parseServingsFromYield, sizeFromLdJson } from "./ingredient-text";
import type { Recipe, RecipeRef } from "./types";

const FALLBACK_SERVINGS = 4;

function extractSteps(recipe: LdJsonRecipe): string[] {
  return (recipe.recipeInstructions ?? [])
    .map((entry) => (typeof entry === "string" ? entry : (entry?.text ?? "")))
    .map((text) => text.trim())
    .filter(Boolean);
}

function normalizeNutrition(recipe: LdJsonRecipe): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(recipe.nutrition ?? {})) {
    if (typeof value === "string" || typeof value === "number") {
      result[key] = String(value);
    }
  }
  return result;
}

function parseKeywords(recipe: LdJsonRecipe): string[] {
  return (recipe.keywords ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

/** Dietary hints a source may expose via schema.org (often empty). */
function dietTags(recipe: LdJsonRecipe): string[] {
  return (recipe.suitableForDiet ?? [])
    .map((entry) => (typeof entry === "string" ? entry : ""))
    .map((entry) => entry.replace(/^https?:\/\/schema\.org\//i, ""))
    .filter(Boolean);
}

/**
 * Turns a page that only ships schema.org JSON-LD (Betty Bossi, FOOBY) into the
 * app's `Recipe` model. Those sources offer a single fixed serving size and no
 * Migros product links, so the shopping list falls back to the Migros search.
 */
export function buildRecipeFromLdJson(html: string, ref: RecipeRef, now = new Date()): Recipe {
  const ld = extractLdJsonRecipe(html) ?? {};
  const servings = parseServingsFromYield(ld.recipeYield, FALLBACK_SERVINGS);
  const size = sizeFromLdJson(ld, servings);
  const images = normalizeImageUrl(ld.image);
  const totalTimeMinutes = parseIsoDuration(ld.totalTime ?? ld.cookTime);
  const ratingValue = Number(ld.aggregateRating?.ratingValue);
  const ratingCount = Number(ld.aggregateRating?.reviewCount ?? ld.aggregateRating?.ratingCount);
  const tags = dietTags(ld);

  return {
    source: ref.source,
    id: ref.id,
    slug: ref.slug,
    title: ld.name ?? ref.title,
    description: ld.description ?? "",
    images,
    image: images[0] ?? null,
    totalTimeMinutes,
    totalTimeText: formatDuration(totalTimeMinutes),
    rating: Number.isFinite(ratingValue) ? ratingValue : null,
    ratingCount: Number.isFinite(ratingCount) ? ratingCount : null,
    nutrition: normalizeNutrition(ld),
    category: ld.recipeCategory ?? null,
    cuisine: ld.recipeCuisine ?? null,
    keywords: [...parseKeywords(ld), ...tags],
    yieldText: ld.recipeYield ?? null,
    sizeOptions: [servings],
    defaultServings: servings,
    servingsUnit: "Personen",
    sizes: [size],
    steps: extractSteps(ld),
    productIds: [],
    sourceUrl: ref.sourceUrl ?? "",
    fetchedAt: now.toISOString(),
  };
}
