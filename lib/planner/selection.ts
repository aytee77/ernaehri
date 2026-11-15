import { DINNER_TAXONOMIES, currentSeasonSlug } from "../migusto/taxonomy";
import { isMainDish } from "../recipes/main-dish";
import { RECIPE_SOURCES, getRecipe, getRecipes, listMainDishRefs, recipeKey, sourceInfo } from "../recipes/registry";
import type { Recipe, RecipeRef, RecipeSource } from "../recipes/types";
import { costMeals, type MealInput } from "../shopping/list";
import type { CostingResult } from "../shopping/types";
import { buildPool, filterByPreferences, isOnSale } from "./pool";
import { shuffled } from "./random";
import type { MealPlan, PlanInput, PlannedMeal, Weekday } from "./types";
import { weekdayLabel } from "./types";

export const PAGES_PER_TAXONOMY = 2;
/** How many Migusto candidates to load details for. */
export const MIGUSTO_DETAIL_FETCHES = 16;
/** How many discovered main dishes to consider per sitemap-driven source (Betty Bossi, FOOBY). */
export const SITEMAP_DETAIL_FETCHES = 8;

interface ScoredRecipe {
  recipe: Recipe;
  score: number;
}

function mealKey(recipe: Recipe): string {
  return `${recipe.category ?? ""}|${recipe.cuisine ?? ""}`;
}

function baseScore(recipe: Recipe, preferences: PlanInput["preferences"], random: () => number): number {
  let score = (recipe.rating ?? 3.5) * 2;
  const minutes = recipe.totalTimeMinutes ?? 60;
  if (minutes <= 30) score += 2;
  else if (minutes <= 45) score += 1.2;
  else if (minutes >= 120) score -= 1;
  if (preferences.quick && minutes > 30) score -= 2;
  if (recipe.productIds.length > 0) score += 0.5;
  return score + random() * 2.5;
}

function taxonomySlugsFor(input: PlanInput): string[] {
  const slugs = new Set<string>(DINNER_TAXONOMIES);
  slugs.add(currentSeasonSlug());
  if (input.preferences.onSale) slugs.add("aktionen");
  if (input.preferences.vegetarian) slugs.add("vegetarisch");
  if (input.preferences.vegan) slugs.add("vegan");
  if (input.preferences.quick) slugs.add("schnelleinfach");
  return [...slugs];
}

/** Migusto candidates: the taxonomy pool, already narrowed by the wizard's answers. */
async function migustoRefs(input: PlanInput, random: () => number): Promise<RecipeRef[]> {
  const pool = await buildPool(taxonomySlugsFor(input), PAGES_PER_TAXONOMY);
  const preferred = filterByPreferences(pool, input.preferences);
  const usable = preferred.length > 0 ? preferred : pool;
  const ranked = shuffled(usable, random);
  if (input.preferences.onSale) {
    ranked.sort((a, b) => Number(isOnSale(b)) - Number(isOnSale(a)));
  }
  return ranked
    .slice(0, MIGUSTO_DETAIL_FETCHES)
    .map((entry) => ({ source: "migusto", id: entry.id, slug: entry.slug, title: entry.title }));
}

/** A sample of a source's discovered main dishes, reshuffled so plans vary. */
async function sitemapRefs(source: RecipeSource, random: () => number): Promise<RecipeRef[]> {
  const refs = await listMainDishRefs(source).catch(() => [] as RecipeRef[]);
  return shuffled(refs, random).slice(0, SITEMAP_DETAIL_FETCHES);
}

function dietText(recipe: Recipe): string {
  return [recipe.title, recipe.description, recipe.category, recipe.cuisine, ...recipe.keywords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Sitemap sources expose no taxonomy filters, so their recipes are filtered on
 * the parsed recipe instead. Diet preferences are matched strictly — unsure
 * recipes are dropped rather than risk a meat dish for a vegetarian plan.
 */
function passesPreferences(recipe: Recipe, input: PlanInput): boolean {
  if (recipe.source === "migusto") {
    return true;
  }

  const preferences = input.preferences;
  if (preferences.quick) {
    const minutes = recipe.totalTimeMinutes;
    if (minutes !== null && minutes > 40) {
      return false;
    }
  }

  if (preferences.vegan || preferences.vegetarian) {
    const pattern = preferences.vegan ? /\bvegan\b/ : /(vegetarisch|vegan|fleischlos)/;
    if (!pattern.test(dietText(recipe))) {
      return false;
    }
  }

  return true;
}

/** Round-robins the sources so a week is not dominated by a single source. */
function selectWithSourceDiversity(scored: ScoredRecipe[], count: number): Recipe[] {
  const bySource = new Map<RecipeSource, ScoredRecipe[]>();
  for (const entry of scored) {
    const list = bySource.get(entry.recipe.source) ?? [];
    list.push(entry);
    bySource.set(entry.recipe.source, list);
  }

  const queues = [...bySource.values()];
  const ordered: ScoredRecipe[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const queue of queues) {
      const next = queue.shift();
      if (next) {
        ordered.push(next);
        added = true;
      }
    }
  }

  const chosen: Recipe[] = [];
  const usedKeys = new Set<string>();

  for (const entry of ordered) {
    if (chosen.length >= count) break;
    const key = mealKey(entry.recipe);
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    chosen.push(entry.recipe);
  }

  for (const entry of ordered) {
    if (chosen.length >= count) break;
    if (!chosen.includes(entry.recipe)) chosen.push(entry.recipe);
  }

  return chosen;
}

/** Reads every source's candidates, scores them and returns the best distinct picks. */
export async function pickRecipes(
  input: PlanInput,
  excludeKeys: Set<string>,
  random: () => number,
  count: number,
): Promise<Recipe[]> {
  const lang = input.lang ?? "de";
  const sitemapSources = RECIPE_SOURCES.filter((source) => source !== "migusto");

  const [migusto, ...sitemap] = await Promise.all([
    migustoRefs(input, random),
    ...sitemapSources.map((source) => sitemapRefs(source, random)),
  ]);

  const refs = [...migusto, ...sitemap.flat()].filter((ref) => !excludeKeys.has(recipeKey(ref)));
  const recipes = await getRecipes(refs, lang);

  // Only main dishes, from every source: Migusto candidates come from main-dish
  // taxonomies, but its season/sale listings can still contain desserts or drinks.
  const scored: ScoredRecipe[] = recipes
    .filter((recipe) => isMainDish(recipe) && passesPreferences(recipe, input))
    .map((recipe) => ({ recipe, score: baseScore(recipe, input.preferences, random) }))
    .sort((a, b) => b.score - a.score);

  return selectWithSourceDiversity(scored, count);
}

export async function costFor(recipes: Recipe[], input: PlanInput, days: Weekday[]): Promise<CostingResult> {
  const meals: MealInput[] = recipes.map((recipe, index) => ({
    recipe,
    day: days[index] ?? days[days.length - 1] ?? "mon",
    title: recipe.title,
  }));
  return costMeals(meals, input.people, input.budgetChf, input.lang ?? "de");
}

export function assemblePlan(
  input: PlanInput,
  recipes: Recipe[],
  days: Weekday[],
  costing: CostingResult,
  planId: string,
): MealPlan {
  const costById = new Map(costing.perMeal.map((meal) => [meal.recipeId, meal]));

  const meals: PlannedMeal[] = recipes.map((recipe, index) => {
    const cost = costById.get(recipe.id);
    return {
      day: days[index] ?? days[days.length - 1] ?? "mon",
      dayLabel: weekdayLabel(days[index] ?? "mon"),
      source: recipe.source,
      sourceLabel: sourceInfo(recipe.source).label,
      recipeId: recipe.id,
      slug: recipe.slug,
      title: recipe.title,
      image: recipe.image,
      totalTimeMinutes: recipe.totalTimeMinutes,
      totalTimeText: recipe.totalTimeText,
      rating: recipe.rating,
      recipeServings: input.people,
      sourceUrl: recipe.sourceUrl,
      estimatedCostChf: cost?.costChf ?? null,
      priceSource: cost?.priceSource ?? "unavailable",
    };
  });

  return {
    id: planId,
    createdAt: new Date().toISOString(),
    input: { ...input, days },
    meals,
    estimatedTotalChf: costing.totalChf,
    budgetChf: input.budgetChf,
    withinBudget: costing.totalChf <= input.budgetChf,
    priceNotice: costing.notice,
    usedRecipeIds: meals.map((meal) => recipeKey({ source: meal.source, id: meal.recipeId })),
  };
}

/** Loads the Recipe objects behind the plan's meal entries (cached). */
export async function resolveRecipes(meals: PlannedMeal[]): Promise<Recipe[]> {
  const recipes = await Promise.all(
    meals.map((meal) =>
      getRecipe(
        { source: meal.source, id: meal.recipeId, slug: meal.slug, title: meal.title },
        "de",
      ).catch(() => null),
    ),
  );
  return recipes.filter((recipe): recipe is Recipe => recipe !== null);
}
