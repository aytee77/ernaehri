import type { ProductSource } from "../migros/types";
import type { Weekday } from "../planner/types";

export interface ShoppingLine {
  key: string;
  label: string;
  /** Combined amount for all meals, e.g. "1.2 kg". */
  amountText: string;
  quantity: number;
  unit: string;
  productUid: string | null;
  productName: string | null;
  productImage: string | null;
  productUrl: string | null;
  priceChf: number | null;
  priceSource: ProductSource;
  category: string;
  pantry: boolean;
  /** Meal titles this line belongs to. */
  usedIn: string[];
}

export interface ShoppingGroup {
  name: string;
  lines: ShoppingLine[];
}

export interface ShoppingList {
  groups: ShoppingGroup[];
  itemCount: number;
  totalChf: number;
  knownPriceCount: number;
  estimatedPriceCount: number;
  missingPriceCount: number;
  budgetChf: number | null;
  withinBudget: boolean | null;
  notice: string | null;
}

export interface MealCost {
  recipeId: string;
  day: Weekday;
  title: string;
  costChf: number | null;
  priceSource: ProductSource;
}

export interface CostingResult {
  perMeal: MealCost[];
  shoppingList: ShoppingList;
  /** Everything you would pay at the till, including one-off pantry items. */
  totalChf: number;
  notice: string | null;
}
