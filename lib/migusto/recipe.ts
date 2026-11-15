import { cacheLife, cacheTag } from "next/cache";
import { migustoFetchHtml } from "./client";
import { extractLdJsonRecipe, formatDuration, normalizeImageUrl, parseIsoDuration } from "./flight";
import type { LdJsonRecipe } from "./flight";
import { sizeFromLdJson } from "./ingredient-text";
import { flattenIngredients, readAvailableSizes, readProductIds, readSizes } from "./recipe-parse";
import type { Lang, Recipe, RecipeRef, RecipeSize } from "./types";

const RECIPE_SEGMENT: Record<Lang, string> = {
  de: "rezepte",
  fr: "recettes",
  it: "ricette",
};

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

/** Turns a raw Migusto recipe page into the app's `Recipe` model. */
export function buildRecipe(html: string, ref: RecipeRef, lang: Lang, now = new Date()): Recipe {
  const ld = extractLdJsonRecipe(html) ?? {};
  const structuredSizes = readSizes(html);
  const sizes: RecipeSize[] =
    structuredSizes.length > 0 ? structuredSizes : [sizeFromLdJson(ld, FALLBACK_SERVINGS)];

  const defaultSize = sizes.find((size) => size.isDefault) ?? sizes[0];
  const images = normalizeImageUrl(ld.image);
  const totalTimeMinutes = parseIsoDuration(ld.totalTime);
  const ratingValue = Number(ld.aggregateRating?.ratingValue);
  const ratingCount = Number(ld.aggregateRating?.reviewCount);
  const availableSizes = readAvailableSizes(html);

  return {
    source: "migusto",
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
    keywords: parseKeywords(ld),
    yieldText: ld.recipeYield ?? defaultSize.textFull ?? null,
    sizeOptions: availableSizes.length > 0 ? availableSizes : sizes.map((size) => size.servings),
    defaultServings: defaultSize.servings,
    servingsUnit: defaultSize.unit || "Personen",
    sizes,
    steps: extractSteps(ld),
    productIds: readProductIds(html),
    sourceUrl: `https://migusto.migros.ch/${lang}/${RECIPE_SEGMENT[lang]}/${ref.slug}/${ref.id}`,
    fetchedAt: now.toISOString(),
  };
}

/** Loads (and caches) a recipe with all its sizes and ingredients. */
export async function getRecipe(id: string, slug: string, lang: Lang = "de"): Promise<Recipe> {
  "use cache";
  cacheLife("days");
  cacheTag("migusto:recipes", `migusto:recipe:${id}`);

  const html = await migustoFetchHtml(`/${lang}/${RECIPE_SEGMENT[lang]}/${slug}/${id}`, lang);
  return buildRecipe(html, { source: "migusto", id, slug, title: "" }, lang);
}

/** Loads several recipes in parallel, tolerating individual failures. */
export async function getRecipes(refs: RecipeRef[], lang: Lang = "de"): Promise<Recipe[]> {
  const settled = await Promise.all(
    refs.map((ref) => getRecipe(ref.id, ref.slug, lang).catch(() => null)),
  );
  return settled.filter((recipe): recipe is Recipe => recipe !== null);
}

/** The default size's ingredients, flattened. */
export function defaultIngredients(recipe: Recipe) {
  const size = recipe.sizes.find((entry) => entry.servings === recipe.defaultServings) ?? recipe.sizes[0];
  return flattenIngredients(size);
}
