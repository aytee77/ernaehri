import type { Lang, Recipe } from "../migusto/types";
import { getProducts } from "../migros/client";
import { estimatePriceChf } from "../migros/fallback-prices";
import { matchIngredients } from "../migros/match";
import { findProductForIngredient } from "../migros/search";
import type { MigrosProduct } from "../migros/types";
import type { Weekday } from "../planner/types";
import { isPantryItem, PANTRY_GROUP_NAME } from "./pantry";
import { formatAmount, scaleRecipe } from "./scale";
import type { CostingResult, MealCost, ShoppingGroup, ShoppingLine } from "./types";

const SEARCH_CONCURRENCY = 5;

/** Runs `task` over the items with a small concurrency limit. */
async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += limit) {
    const batch = items.slice(index, index + limit);
    results.push(...(await Promise.all(batch.map((item) => task(item)))));
  }
  return results;
}

export interface MealInput {
  recipe: Recipe;
  day: Weekday;
  title: string;
}

interface Bucket {
  quantity: number;
  parts: string[];
  line: ShoppingLine;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function groupLines(lines: ShoppingLine[]): ShoppingGroup[] {
  const byCategory = new Map<string, ShoppingLine[]>();
  for (const line of lines) {
    const list = byCategory.get(line.category) ?? [];
    list.push(line);
    byCategory.set(line.category, list);
  }

  return [...byCategory.entries()]
    .sort(([a], [b]) => (a === PANTRY_GROUP_NAME ? 1 : b === PANTRY_GROUP_NAME ? -1 : a.localeCompare(b, "de")))
    .map(([name, list]) => ({
      name,
      lines: [...list].sort((a, b) => a.label.localeCompare(b.label, "de")),
    }));
}

/** Builds and prices the shopping list: ingredients are matched to the Migros
 * products Migusto links to each recipe, scaled to the people count and merged. */
export async function costMeals(
  meals: MealInput[],
  people: number,
  budgetChf: number | null = null,
  lang: Lang = "de",
): Promise<CostingResult> {
  const allIds = [...new Set(meals.flatMap((meal) => meal.recipe.productIds))];
  const lookup = await getProducts(allIds, lang);

  const buckets = new Map<string, Bucket>();
  const perMeal: MealCost[] = [];
  const notices: string[] = lookup.notice ? [lookup.notice] : [];

  for (const meal of meals) {
    const recipeProducts = lookup.products.filter((product) => meal.recipe.productIds.includes(product.uid));
    const scaled = scaleRecipe(meal.recipe, people);
    const relevant = scaled.ingredients.filter((entry) => entry.ingredient.isShoppingListRelevant);
    const matches = matchIngredients(
      relevant.map((entry) => entry.ingredient),
      recipeProducts,
    );
    const scaledByKey = new Map(relevant.map((entry) => [entry.ingredient.key, entry]));

    // Ingredients Migusto didn't link to a product: look them up in the Migros
    // product search so the shopping list still gets a real price and link.
    const namesToSearch = [
      ...new Set(matches.filter((match) => !match.product).map((match) => match.ingredient.name)),
    ].filter((name) => !isPantryItem(name, null));

    const searched = new Map<string, MigrosProduct>();
    await mapLimited(namesToSearch, SEARCH_CONCURRENCY, async (name) => {
      try {
        const product = await findProductForIngredient(name, lang);
        if (product) {
          searched.set(name, product);
        }
      } catch {
        // the search is a bonus; without it the estimate is used
      }
      return null;
    });

    let cost = 0;
    let priced = 0;
    let estimated = 0;

    for (const match of matches) {
      const scaledIngredient = scaledByKey.get(match.ingredient.key);
      if (!scaledIngredient) {
        continue;
      }

      const product = match.product ?? searched.get(match.ingredient.name) ?? null;
      const price = product?.priceChf ?? estimatePriceChf(match.ingredient.name).priceChf;
      const pantry = isPantryItem(match.ingredient.name, product?.leafCategory ?? null);
      const category = pantry ? PANTRY_GROUP_NAME : (product?.leafCategory ?? "Sonstiges");
      const key = product
        ? `uid:${product.uid}`
        : `name:${match.ingredient.name.toLowerCase()}|${scaledIngredient.unit}`;

      const bucket = buckets.get(key);
      if (bucket) {
        bucket.quantity += scaledIngredient.quantity;
        if (scaledIngredient.amountText) {
          bucket.parts.push(scaledIngredient.amountText);
        }
        if (!bucket.line.usedIn.includes(meal.title)) {
          bucket.line.usedIn.push(meal.title);
        }
      } else {
        buckets.set(key, {
          quantity: scaledIngredient.quantity,
          parts: scaledIngredient.amountText ? [scaledIngredient.amountText] : [],
          line: {
            key,
            label: product?.name ?? match.ingredient.name,
            amountText: scaledIngredient.amountText,
            quantity: scaledIngredient.quantity,
            unit: scaledIngredient.unit,
            productUid: product?.uid ?? null,
            productName: product?.name ?? null,
            productImage: product?.image ?? null,
            productUrl: product?.url ?? null,
            priceChf: price,
            priceSource: product ? lookup.source : "fallback",
            category,
            pantry,
            usedIn: [meal.title],
          },
        });
      }

      if (!pantry) {
        cost += price ?? 0;
        if (product) {
          priced += 1;
        } else {
          estimated += 1;
        }
      }
    }

    perMeal.push({
      recipeId: meal.recipe.id,
      day: meal.day,
      title: meal.title,
      costChf: Math.round(cost * 20) / 20,
      priceSource: priced > 0 ? lookup.source : estimated > 0 ? "fallback" : lookup.source,
    });
  }

  const lines: ShoppingLine[] = [...buckets.values()].map((bucket) => ({
    ...bucket.line,
    quantity: round(bucket.quantity),
    amountText: bucket.parts.length > 1 ? bucket.parts.join(" + ") : formatAmount(bucket.quantity, bucket.line.unit),
  }));

  const mealsTotal = round(lines.reduce((sum, line) => sum + (line.pantry ? 0 : (line.priceChf ?? 0)), 0));
  const pantryTotal = round(lines.reduce((sum, line) => sum + (line.pantry ? (line.priceChf ?? 0) : 0), 0));
  const totalChf = round(mealsTotal + pantryTotal);

  const missingPriceCount = lines.filter((line) => line.priceChf === null).length;
  const estimatedPriceCount = lines.filter((line) => line.priceSource === "fallback").length;
  if (missingPriceCount > 0) {
    notices.push(`${missingPriceCount} Position(en) ohne Preis.`);
  }

  const notice = notices.length > 0 ? notices.join(" ") : null;

  return {
    perMeal,
    totalChf,
    notice,
    shoppingList: {
      groups: groupLines(lines),
      itemCount: lines.length,
      totalChf,
      knownPriceCount: lines.length - estimatedPriceCount,
      estimatedPriceCount,
      missingPriceCount,
      budgetChf,
      withinBudget: budgetChf === null ? null : totalChf <= budgetChf,
      notice,
    },
  };
}
