import type { Lang, RecipeSource } from "../recipes/types";
import type { ProductSource } from "../migros/types";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAYS: ReadonlyArray<{ id: Weekday; label: string; short: string }> = [
  { id: "mon", label: "Montag", short: "Mo" },
  { id: "tue", label: "Dienstag", short: "Di" },
  { id: "wed", label: "Mittwoch", short: "Mi" },
  { id: "thu", label: "Donnerstag", short: "Do" },
  { id: "fri", label: "Freitag", short: "Fr" },
  { id: "sat", label: "Samstag", short: "Sa" },
  { id: "sun", label: "Sonntag", short: "So" },
];

export function weekdayLabel(day: Weekday): string {
  return WEEKDAYS.find((entry) => entry.id === day)?.label ?? day;
}

export interface PlanPreferences {
  vegetarian: boolean;
  vegan: boolean;
  quick: boolean;
  onSale: boolean;
}

export interface PlanInput {
  people: number;
  days: Weekday[];
  budgetChf: number;
  preferences: PlanPreferences;
  lang?: Lang;
}

export interface PlannedMeal {
  day: Weekday;
  dayLabel: string;
  /** Which recipe source this meal comes from. */
  source: RecipeSource;
  /** Display label of the source, e.g. "Betty Bossi". */
  sourceLabel: string;
  recipeId: string;
  slug: string;
  title: string;
  image: string | null;
  totalTimeMinutes: number | null;
  totalTimeText: string | null;
  rating: number | null;
  recipeServings: number;
  sourceUrl: string;
  estimatedCostChf: number | null;
  priceSource: ProductSource;
}

export interface MealPlan {
  id: string;
  createdAt: string;
  input: PlanInput;
  meals: PlannedMeal[];
  estimatedTotalChf: number | null;
  budgetChf: number;
  withinBudget: boolean;
  priceNotice: string | null;
  /** Recipe ids already in the plan, so "regenerate" never repeats one. */
  usedRecipeIds: string[];
}

export const DEFAULT_PREFERENCES: PlanPreferences = {
  vegetarian: false,
  vegan: false,
  quick: false,
  onSale: false,
};
