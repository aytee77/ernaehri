import type { Ingredient, Recipe, RecipeSize } from "../migusto/types";
import { flattenIngredients } from "../migusto/recipe-parse";

export interface ScaledIngredient {
  ingredient: Ingredient;
  quantity: number;
  unit: string;
  amountText: string;
}

export interface ScaledRecipe {
  recipe: Recipe;
  /** Servings the plan is cooked for. */
  servings: number;
  /** The Migusto size the amounts are based on. */
  baseSize: RecipeSize;
  /** people / baseSize.servings */
  factor: number;
  ingredients: ScaledIngredient[];
}

function pickSize(recipe: Recipe, people: number): RecipeSize {
  const sizes = recipe.sizes.length > 0 ? recipe.sizes : [];
  if (sizes.length === 0) {
    throw new Error(`Rezept ${recipe.id} hat keine Portionsgrössen`);
  }
  return sizes.reduce((best, size) =>
    Math.abs(size.servings - people) < Math.abs(best.servings - people) ? size : best,
  );
}

function roundAmount(quantity: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized === "" || normalized === "stück" || normalized === "stk") {
    return Math.ceil(quantity * 2) / 2;
  }
  if (quantity >= 100) {
    return Math.round(quantity);
  }
  if (quantity >= 10) {
    return Math.round(quantity * 2) / 2;
  }
  return Math.round(quantity * 100) / 100;
}

export function formatAmount(quantity: number, unit: string): string {
  if (quantity <= 0) {
    return unit ? unit : "";
  }
  const rounded = Math.round(quantity * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "");
  return unit ? `${text} ${unit}` : text;
}

/** Scales a recipe's shopping-relevant amounts to the number of people. */
export function scaleRecipe(recipe: Recipe, people: number): ScaledRecipe {
  const baseSize = pickSize(recipe, people);
  const factor = people / baseSize.servings;

  const ingredients: ScaledIngredient[] = flattenIngredients(baseSize).map((ingredient) => {
    const unit = ingredient.amount?.unit ?? "";
    const quantity = roundAmount((ingredient.amount?.quantity ?? 0) * factor, unit);
    return {
      ingredient,
      quantity,
      unit,
      amountText: quantity > 0 ? formatAmount(quantity, unit) : "",
    };
  });

  return { recipe, servings: people, baseSize, factor, ingredients };
}
