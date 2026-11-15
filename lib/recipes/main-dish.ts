import type { Recipe } from "./types";

/**
 * Recipe classifications that count as a main dish, per source wording:
 * - Migusto: "Hauptgericht"
 * - Betty Bossi: "Hauptspeise"
 * - FOOBY: "Hauptgericht"
 */
const MAIN_DISH_TOKENS = ["hauptgericht", "hauptgerichte", "hauptspeise", "hauptgang"];

/**
 * Slug tokens that are clearly not a main dish (desserts, drinks, baking,
 * preserves, finger food). Only used to skip needless fetches — the real filter
 * is `isMainDish`, so a missed token costs nothing but a little bandwidth.
 */
const NON_MAIN_SLUG_TOKENS = [
  "smoothie",
  "shake",
  "sorbet",
  "glace",
  "parfait",
  "mousse",
  "pudding",
  "tiramisu",
  "dessert",
  "cake",
  "kuchen",
  "torte",
  "gugelhopf",
  "gugelhupf",
  "muffin",
  "brownie",
  "cookie",
  "guetzli",
  "guetsli",
  "kipferli",
  "brunsli",
  "stengeli",
  "zimtstern",
  "weggli",
  "lebkuchen",
  "macaron",
  "marmelade",
  "konfiture",
  "konfitüre",
  "gelee",
  "chutney",
  "punch",
  "punsch",
  "cocktail",
  "aperitif",
  "sirup",
  "limonade",
  "bowle",
  "gluehwein",
  "glühwein",
  "apero",
  "fingerfood",
  "vorspeise",
  "beilage",
  "brot",
  "brioche",
  "croissant",
  "baguette",
  "muesli",
  "müsli",
  "bircher",
  "granola",
];

/**
 * True when the recipe's own classification marks it as a main dish. Sources
 * are inconsistent (FOOBY sometimes files a main under "Geflügel" or leaves the
 * field empty), so this is deliberately strict: a recipe only passes when its
 * classification explicitly says main dish. Missing a main is fine, showing a
 * smoothie is not.
 */
export function isMainDish(recipe: Pick<Recipe, "category" | "keywords">): boolean {
  const haystack = [recipe.category ?? "", ...(recipe.keywords ?? [])].join(" ").toLowerCase();
  return MAIN_DISH_TOKENS.some((token) => haystack.includes(token));
}

/** Cheap guess used to avoid fetching obvious desserts, drinks and bakes. */
export function slugLooksNonMain(slug: string): boolean {
  const normalized = slug.toLowerCase();
  return NON_MAIN_SLUG_TOKENS.some((token) => normalized.includes(token));
}
