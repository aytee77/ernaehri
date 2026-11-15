export type Lang = "de" | "fr" | "it";

/** Where a recipe comes from. Products and prices are always Migros. */
export type RecipeSource = "migusto" | "bettybossi" | "fooby";

/** Human readable metadata about a recipe source (safe to use in client components). */
export interface SourceInfo {
  id: RecipeSource;
  /** Short label used in badges, e.g. "Betty Bossi". */
  label: string;
  /** Wording for the outbound recipe link, e.g. "Rezept auf Betty Bossi öffnen ↗". */
  linkLabel: string;
  /** Public home page of the source. */
  homeUrl: string;
}

/** A recipe as it appears in a listing page (source-agnostic). */
export interface RecipeRef {
  source: RecipeSource;
  id: string;
  slug: string;
  title: string;
  /** Canonical public page of the recipe, when the source knows it. */
  sourceUrl?: string;
}

/** Amount as delivered by a recipe source. */
export interface IngredientAmount {
  quantity: number;
  quantityUpTo: number | null;
  unit: string;
  text: string;
  isApproximate: boolean;
}

/** One ingredient of a recipe at a specific size. */
export interface Ingredient {
  /** Stable key used for aggregation: source ingredient id when available. */
  key: string;
  /** Display name, e.g. "Zwiebeln". */
  name: string;
  singular: string;
  plural: string;
  ingredientId: string | null;
  amount: IngredientAmount | null;
  isMain: boolean;
  /** Does this belong on the shopping list? */
  isShoppingListRelevant: boolean;
  cultivar: string | null;
}

export interface IngredientGroup {
  title: string | null;
  ingredients: Ingredient[];
}

/** A recipe variant for a given number of servings ("Für 4 Personen"). */
export interface RecipeSize {
  servings: number;
  unit: string;
  text: string;
  textFull: string;
  isDefault: boolean;
  groups: IngredientGroup[];
}

export interface Recipe {
  source: RecipeSource;
  id: string;
  slug: string;
  title: string;
  description: string;
  images: string[];
  image: string | null;
  totalTimeMinutes: number | null;
  totalTimeText: string | null;
  rating: number | null;
  ratingCount: number | null;
  nutrition: Record<string, string>;
  category: string | null;
  cuisine: string | null;
  keywords: string[];
  yieldText: string | null;
  sizeOptions: number[];
  defaultServings: number;
  servingsUnit: string;
  /** Every size the source offers (2, 4, 6, … people). */
  sizes: RecipeSize[];
  steps: string[];
  /** Migros product UIDs the source links to this recipe (Migusto only). */
  productIds: string[];
  sourceUrl: string;
  fetchedAt: string;
}
