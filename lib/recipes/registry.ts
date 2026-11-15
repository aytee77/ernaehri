import { getBettyBossiRecipe } from "../bettybossi/recipe";
import { listBettyBossiRefs } from "../bettybossi/sitemap";
import { getFoobyRecipe } from "../fooby/recipe";
import { listFoobyRefs } from "../fooby/sitemap";
import { getRecipe as getMigustoRecipe } from "../migusto/recipe";
import { cacheLife, cacheTag } from "next/cache";
import { mapLimited } from "./http";
import { isMainDish, slugLooksNonMain } from "./main-dish";
import type { Lang, Recipe, RecipeRef, RecipeSource } from "./types";

export { SOURCE_INFO, RECIPE_SOURCES, isRecipeSource, sourceInfo, recipeKey } from "./sources";

/** Recipe detail fetches per source are capped to be gentle on the sources. */
const DETAIL_CONCURRENCY = 4;
/** How many recipes to classify per sitemap source and cache period. */
const DISCOVERY_BATCH: Record<RecipeSource, number> = { migusto: 0, bettybossi: 20, fooby: 26 };

/** Stable pseudo-random key: fixed order per salt, rotating between cache periods. */
function rotationKey(id: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Loads one recipe, dispatching to the adapter of its source. */
export async function getRecipe(ref: RecipeRef, lang: Lang = "de"): Promise<Recipe> {
  switch (ref.source) {
    case "bettybossi":
      return getBettyBossiRecipe(ref.id, ref.slug);
    case "fooby":
      return getFoobyRecipe(ref.id, ref.slug);
    case "migusto":
    default:
      return getMigustoRecipe(ref.id, ref.slug, lang);
  }
}

/** Loads several recipes across sources in parallel, tolerating individual failures. */
export async function getRecipes(refs: RecipeRef[], lang: Lang = "de"): Promise<Recipe[]> {
  const settled = await mapLimited(refs, DETAIL_CONCURRENCY, (ref) =>
    getRecipe(ref, lang).catch(() => null),
  );
  return settled.filter((recipe): recipe is Recipe => recipe !== null);
}

/**
 * Candidate refs for a source. Migusto candidates come from its taxonomy
 * listings (see `lib/planner/pool.ts`), so only sitemap-driven sources return
 * anything here.
 */
export async function listSourceCandidates(source: RecipeSource): Promise<RecipeRef[]> {
  switch (source) {
    case "bettybossi":
      return listBettyBossiRefs();
    case "fooby":
      return listFoobyRefs();
    default:
      return [];
  }
}

/**
 * Sitemap sources expose no taxonomy, and their own category fields are patchy,
 * so a main dish can only be recognised after loading a recipe. That is done
 * once per cache period: a rotating sample of the sitemap is classified and only
 * the main dishes are kept. The planner then picks from this (cached) list, so
 * generating a plan stays cheap and every candidate is guaranteed to be a main.
 */
export async function listMainDishRefs(source: RecipeSource): Promise<RecipeRef[]> {
  "use cache";
  cacheLife("days");
  cacheTag(`${source}:catalog`, `${source}:main-dishes`);

  const batch = DISCOVERY_BATCH[source];
  if (!batch) {
    return [];
  }

  const refs = await listSourceCandidates(source).catch(() => [] as RecipeRef[]);
  const candidates = refs.filter((ref) => !slugLooksNonMain(ref.slug));
  const salt = Math.floor(Date.now() / 86_400_000);
  const sample = [...candidates]
    .sort((a, b) => rotationKey(a.id, salt) - rotationKey(b.id, salt))
    .slice(0, batch);

  const recipes = await mapLimited(sample, DETAIL_CONCURRENCY, (ref) =>
    getRecipe(ref, "de").catch(() => null),
  );

  return recipes
    .filter((recipe): recipe is Recipe => recipe !== null && isMainDish(recipe))
    .map((recipe) => ({ source: recipe.source, id: recipe.id, slug: recipe.slug, title: recipe.title }));
}

/** Titles of the discovered main dishes per source — used by the diagnostics endpoint. */
export async function mainDishCount(source: RecipeSource): Promise<number> {
  return (await listMainDishRefs(source)).length;
}
