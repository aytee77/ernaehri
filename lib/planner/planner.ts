import type { Recipe } from "../migusto/types";
import { recipeKey } from "../recipes/sources";
import { hashString, mulberry32 } from "./random";
import { assemblePlan, costFor, pickRecipes, resolveRecipes } from "./selection";
import type { MealPlan, PlanInput, Weekday } from "./types";
import { weekdayLabel } from "./types";

const MAX_REPAIR_ATTEMPTS = 3;
const MAX_SPARE_FETCHES = 4;
const DEFAULT_DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

export interface GeneratePlanOptions {
  input: PlanInput;
  /** Recipes that must not be picked (e.g. the ones already on the plan). */
  excludeIds?: string[];
  /** Makes a regeneration produce a different week. */
  nonce?: string;
}

function newPlanId(): string {
  return `plan_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Generates a whole week: pool → recipes → costs → budget fit. */
export async function generatePlan(options: GeneratePlanOptions): Promise<MealPlan> {
  const { input } = options;
  const exclude = new Set(options.excludeIds ?? []);
  const planId = newPlanId();
  const random = mulberry32(
    hashString(JSON.stringify({ input, exclude: [...exclude].sort(), nonce: options.nonce ?? planId })),
  );

  const days = input.days.length > 0 ? input.days : DEFAULT_DAYS;
  let chosen = await pickRecipes(input, exclude, random, days.length);

  if (chosen.length === 0) {
    throw new Error("Keine passenden Rezepte gefunden. Bitte die Präferenzen anpassen.");
  }

  let costing = await costFor(chosen, input, days);

  // Budget repair: swap the priciest meals for cheaper candidates.
  for (let attempt = 0; attempt < MAX_REPAIR_ATTEMPTS; attempt += 1) {
    if (costing.totalChf <= input.budgetChf) {
      break;
    }

    const costById = new Map(costing.perMeal.map((meal) => [meal.recipeId, meal.costChf ?? 0]));
    const priciest = [...chosen].sort((a, b) => (costById.get(b.id) ?? 0) - (costById.get(a.id) ?? 0))[0];
    const replaceIndex = chosen.indexOf(priciest);

    const spares = await pickRecipes(
      input,
      new Set([...exclude, ...chosen.map((recipe) => recipeKey(recipe))]),
      random,
      MAX_SPARE_FETCHES,
    );
    if (spares.length === 0) {
      break;
    }

    let improved = false;
    for (const spare of spares) {
      const candidate = [...chosen];
      candidate[replaceIndex] = spare;
      const candidateCosting = await costFor(candidate, input, days);
      if (candidateCosting.totalChf < costing.totalChf) {
        chosen = candidate;
        costing = candidateCosting;
        improved = true;
        break;
      }
    }

    if (!improved) {
      break;
    }
  }

  return assemblePlan(input, chosen, days, costing, planId);
}

/** Drops a meal from the plan and recalculates costs and shopping list. */
export async function removeMealFromPlan(plan: MealPlan, day: Weekday): Promise<MealPlan> {
  const keep = plan.meals.filter((meal) => meal.day !== day);
  if (keep.length === 0) {
    throw new Error("Der Plan braucht mindestens ein Gericht.");
  }

  const recipes: Recipe[] = await resolveRecipes(keep);
  const days = keep.map((meal) => meal.day);
  const costing = await costFor(recipes, plan.input, days);
  return assemblePlan(plan.input, recipes, days, costing, plan.id);
}

/** Replaces a single meal with a different recipe and refreshes the costs. */
export async function swapMealInPlan(plan: MealPlan, day: Weekday): Promise<MealPlan> {
  if (!plan.meals.some((meal) => meal.day === day)) {
    throw new Error(`Kein Gericht für ${weekdayLabel(day)} im Plan.`);
  }

  const random = mulberry32(hashString(`${plan.id}:${day}:${Date.now()}`));
  const replacements = await pickRecipes(plan.input, new Set(plan.usedRecipeIds), random, 1);

  if (replacements.length === 0) {
    throw new Error("Kein anderes Rezept gefunden – bitte die Präferenzen anpassen.");
  }

  const recipes = await resolveRecipes(plan.meals);
  const index = plan.meals.findIndex((meal) => meal.day === day);
  recipes[index] = replacements[0];

  const days = plan.meals.map((meal) => meal.day);
  const costing = await costFor(recipes, plan.input, days);
  return assemblePlan(plan.input, recipes, days, costing, plan.id);
}
