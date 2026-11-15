import type { Ingredient, IngredientGroup, RecipeSize } from "./types";
import { readFlightValues } from "./flight";

/* Raw shapes exactly as they appear in Migusto's flight payload. */

interface RawAmount {
  quantity?: number;
  quantityUpTo?: number | null;
  unit?: string;
  text?: string;
  isApproximate?: boolean;
}

interface RawIngredient {
  text?: string;
  isMainIngredient?: boolean;
  isShoppingListRelevant?: boolean;
  amount?: RawAmount | null;
  cultivar?: string | null;
  ingredient?: { id?: string; name?: { singular?: string; plural?: string } } | null;
}

interface RawBlock {
  title?: string | null;
  ingredients?: RawIngredient[];
}

interface RawSize {
  quantity?: number;
  unit?: string;
  text?: string;
  textFull?: string;
  default?: boolean;
  ingredientBlocks?: RawBlock[];
}

function mapIngredient(raw: RawIngredient): Ingredient {
  const singular = raw.ingredient?.name?.singular ?? "";
  const plural = raw.ingredient?.name?.plural ?? "";
  const name = raw.text || plural || singular;
  const ingredientId = raw.ingredient?.id ?? null;

  return {
    key: ingredientId ? `ing:${ingredientId}` : `name:${name.toLowerCase()}`,
    name,
    singular: singular || name,
    plural: plural || name,
    ingredientId,
    amount: raw.amount
      ? {
          quantity: raw.amount.quantity ?? 0,
          quantityUpTo: raw.amount.quantityUpTo ?? null,
          unit: raw.amount.unit ?? "",
          text: raw.amount.text ?? "",
          isApproximate: Boolean(raw.amount.isApproximate),
        }
      : null,
    isMain: Boolean(raw.isMainIngredient),
    isShoppingListRelevant: Boolean(raw.isShoppingListRelevant),
    cultivar: raw.cultivar ?? null,
  };
}

function mapSize(raw: RawSize | null | undefined): RecipeSize {
  if (!raw || typeof raw !== "object") {
    return { servings: 0, unit: "", text: "", textFull: "", isDefault: false, groups: [] };
  }

  const groups: IngredientGroup[] = (raw.ingredientBlocks ?? []).map((block) => ({
    title: block?.title ?? null,
    ingredients: (block?.ingredients ?? []).filter(Boolean).map(mapIngredient),
  }));

  return {
    servings: raw.quantity ?? 0,
    unit: raw.unit ?? "",
    text: raw.text ?? "",
    textFull: raw.textFull ?? "",
    isDefault: Boolean(raw.default),
    groups,
  };
}

/** Every size Migusto offers for this recipe (e.g. 2, 4, 6 … people). */
export function readSizes(html: string): RecipeSize[] {
  for (const candidate of readFlightValues(html, "sizes")) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    const sizes = candidate
      .filter((entry): entry is RawSize => Boolean(entry) && typeof entry === "object")
      .map((entry) => mapSize(entry))
      .filter((size) => size.servings > 0 && size.groups.length > 0);
    if (sizes.length > 0) {
      return sizes;
    }
  }
  return [];
}

export function readAvailableSizes(html: string): number[] {
  for (const candidate of readFlightValues(html, "availableSizes")) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    const numbers = candidate.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
    if (numbers.length > 0) {
      return numbers;
    }
  }
  return [];
}

/** Migros product UIDs ("Zutaten in deiner Migros") linked to the recipe. */
export function readProductIds(html: string): string[] {
  for (const candidate of readFlightValues(html, "productIds")) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    const ids = candidate.filter((value): value is string => typeof value === "string" && /^\d{6,}$/.test(value));
    if (ids.length > 0) {
      return ids;
    }
  }
  return [];
}

/**
 * The api.migros.ch credentials Migusto ships to every visitor for its product
 * widgets. They are a public client key, but can be overridden via env.
 */
export function readMigrosApiConfig(html: string): { apiUri: string | null; apiKey: string | null } {
  const apiUri = /\\"apiUri\\":\\"([^\\]+)/.exec(html)?.[1] ?? null;
  const apiKey = /\\"apiKey\\":\\"([^\\]+)/.exec(html)?.[1] ?? null;
  return { apiUri, apiKey };
}

export function flattenIngredients(size: RecipeSize): Ingredient[] {
  return size.groups.flatMap((group) => group.ingredients);
}
