import type { MealPlan, PlanInput, PlanPreferences, Weekday } from "./types";
import { WEEKDAYS } from "./types";
import { isRecipeSource, recipeKey, sourceInfo } from "../recipes/sources";

export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const DAY_IDS = new Set<string>(WEEKDAYS.map((day) => day.id));
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;
const ID_PATTERN = /^\d{1,12}$/;

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && DAY_IDS.has(value);
}

function sanitizePreferences(raw: unknown): PlanPreferences {
  const value = (raw ?? {}) as Partial<PlanPreferences>;
  return {
    vegetarian: Boolean(value.vegetarian),
    vegan: Boolean(value.vegan),
    quick: Boolean(value.quick),
    onSale: Boolean(value.onSale),
  };
}

/** Validates and clamps everything that comes from the browser. */
export function sanitizeInput(raw: unknown): PlanInput {
  const value = (raw ?? {}) as Partial<PlanInput>;

  const people = Math.min(12, Math.max(1, Math.round(Number(value.people) || 2)));
  const budget = Math.min(500, Math.max(20, Math.round(Number(value.budgetChf) || 120)));

  const days = Array.isArray(value.days) ? [...new Set(value.days.filter(isWeekday))] : [];
  const orderedDays = WEEKDAYS.map((day) => day.id).filter((day) => days.includes(day));

  return {
    people,
    budgetChf: budget,
    days: orderedDays.length > 0 ? orderedDays : ["mon", "tue", "wed", "thu", "fri"],
    preferences: sanitizePreferences(value.preferences),
    lang: "de",
  };
}

/**
 * The plan round-trips through the browser, so everything is re-validated here.
 * Recipe ids and slugs end up in a Migusto URL, so they are strictly checked.
 */
export function sanitizePlan(raw: unknown): MealPlan {
  const plan = raw as MealPlan;
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.meals) || plan.meals.length === 0) {
    throw new Error("Ungültiger Wochenplan.");
  }

  const meals = plan.meals.map((meal) => {
    if (!isWeekday(meal?.day)) {
      throw new Error("Ungültiger Wochentag im Plan.");
    }
    if (!ID_PATTERN.test(String(meal.recipeId)) || !SLUG_PATTERN.test(String(meal.slug))) {
      throw new Error("Ungültige Rezeptreferenz im Plan.");
    }
    // Plans stored before multi-source support have no source: they are Migusto.
    const source = isRecipeSource(meal.source) ? meal.source : "migusto";
    return {
      ...meal,
      source,
      sourceLabel: sourceInfo(source).label,
      sourceUrl: typeof meal.sourceUrl === "string" ? meal.sourceUrl : "",
    };
  });

  const input = sanitizeInput(plan.input);

  return {
    id: typeof plan.id === "string" && plan.id.length > 0 ? plan.id.slice(0, 64) : "plan_local",
    createdAt: typeof plan.createdAt === "string" ? plan.createdAt : new Date().toISOString(),
    input,
    meals,
    estimatedTotalChf: typeof plan.estimatedTotalChf === "number" ? plan.estimatedTotalChf : null,
    budgetChf: input.budgetChf,
    withinBudget: Boolean(plan.withinBudget),
    priceNotice: typeof plan.priceNotice === "string" ? plan.priceNotice : null,
    usedRecipeIds: meals.map((meal) => recipeKey({ source: meal.source, id: meal.recipeId })),
  };
}

export function toError(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler.";
}
