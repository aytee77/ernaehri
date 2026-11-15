import type { Ingredient, RecipeSize } from "./types";
import type { LdJsonRecipe } from "../migusto/flight";

const UNIT_WORDS = new Set([
  "g",
  "gr",
  "kg",
  "mg",
  "ml",
  "cl",
  "dl",
  "l",
  "el",
  "tl",
  "stk",
  "st",
  "stück",
  "bund",
  "zweig",
  "zweige",
  "prise",
  "prisen",
  "scheibe",
  "scheiben",
  "packung",
  "packungen",
  "päckli",
  "dose",
  "dosen",
  "becher",
  "beutel",
  "sack",
  "cm",
  "mm",
  "tropfen",
  "handvoll",
  "kugel",
  "kugeln",
]);

/** Unicode vulgar fractions, used by Betty Bossi and FOOBY ("1 ½ kg"). */
const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅐": 1 / 7,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
  "⅑": 1 / 9,
  "⅒": 1 / 10,
};

const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join("");

export interface ParsedIngredientText {
  quantity: number;
  unit: string;
  name: string;
}

function parseNumberToken(token: string): number {
  if (token.includes("/")) {
    const [numerator, denominator] = token.split("/").map((part) => Number(part));
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
    return 0;
  }
  return Number(token.replace(",", ".")) || 0;
}

/** Reads the leading amount of an ingredient line ("1 ½" … "2,5" … "1/2" … "½"). */
function parseLeadingAmount(text: string): { quantity: number; rest: string } | null {
  const plain = /^(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)/.exec(text);
  if (plain) {
    let quantity = parseNumberToken(plain[1].replace(/\s+/g, ""));
    let rest = text.slice(plain[0].length);
    const fraction = new RegExp(`^\\s*([${FRACTION_CHARS}])`).exec(rest);
    if (fraction) {
      quantity += UNICODE_FRACTIONS[fraction[1]];
      rest = rest.slice(fraction[0].length);
    }
    return { quantity, rest: rest.trim() };
  }

  const onlyFraction = new RegExp(`^([${FRACTION_CHARS}])\\s*(.*)$`).exec(text);
  if (onlyFraction) {
    return { quantity: UNICODE_FRACTIONS[onlyFraction[1]], rest: onlyFraction[2].trim() };
  }

  return null;
}

/**
 * Fallback parser for ingredient lines such as "800 g Rindsragout", "4 Eier",
 * "1 ½ kg Kartoffeln" or "wenig Pfeffer". Used for sources that only expose
 * schema.org `recipeIngredient` text (Betty Bossi, FOOBY) and by Migusto when
 * its structured payload is unavailable.
 */
export function parseIngredientText(text: string): ParsedIngredientText {
  const trimmed = text.trim().replace(/^(?:ca\.?|ungefähr|etwa|à)\s+/i, "");
  const amount = parseLeadingAmount(trimmed);

  // Drop parenthetical notes ("250 g Teigwaren (z. B. Älplermagronen)") — they
  // only get in the way of the Migros product search.
  let rest = (amount ? amount.rest : trimmed)
    .replace(/\s*\([^)]*\)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  let quantity = amount?.quantity ?? 0;

  // Trailing upper bound of a range ("3-4 Zweige", "2 – 3 Zwiebeln").
  rest = rest.replace(/^(?:bis|[–-])\s*\d+(?:[.,]\d+)?\s*/i, "").trim();

  // No leading number but a range ("2-3 Zwiebeln", "2 bis 3 Zwiebeln").
  if (!amount) {
    const range = /^(\d+(?:[.,]\d+)?)\s*(?:[–-]|bis)\s*\d+(?:[.,]\d+)?\b/.exec(rest);
    if (range) {
      quantity = parseNumberToken(range[1]);
      rest = rest.slice(range[0].length).trim();
    }
  }

  // Amount words without a number ("wenig Pfeffer", "etwas Öl"): keep the
  // ingredient but do not invent a quantity.
  const approximate = /^(?:wenig|etwas|genügend|reichlich|nach Belieben|nach Bedarf|evtl\.?)\s+/i.exec(rest);
  if (approximate && quantity === 0) {
    rest = rest.slice(approximate[0].length).trim();
  }

  let unit = "";
  const unitMatch = /^([A-Za-zäöüÄÖÜ.]{1,12})\b/.exec(rest);
  if (unitMatch && UNIT_WORDS.has(unitMatch[1].toLowerCase().replace(/\.$/, ""))) {
    unit = unitMatch[1];
    rest = rest.slice(unitMatch[0].length).trim();
  }

  rest = rest.replace(/^(?:bis|[–-])\s*\d+(?:[.,]\d+)?\s*/i, "").trim();

  return { quantity, unit, name: rest || trimmed };
}

/** First integer inside a `recipeYield` value ("4 Personen", "Für 2", "4"). */
export function parseServingsFromYield(yieldText: string | null | undefined, fallback: number): number {
  const match = /(\d+)/.exec(yieldText ?? "");
  const value = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Builds a single pseudo-size from schema.org data when no richer payload exists. */
export function sizeFromLdJson(recipe: LdJsonRecipe, servings: number): RecipeSize {
  const ingredients: Ingredient[] = (recipe.recipeIngredient ?? []).map((line) => {
    const parsed = parseIngredientText(line);
    return {
      key: `name:${parsed.name.toLowerCase()}`,
      name: parsed.name,
      singular: parsed.name,
      plural: parsed.name,
      ingredientId: null,
      amount: parsed.quantity
        ? {
            quantity: parsed.quantity,
            quantityUpTo: null,
            unit: parsed.unit,
            text: `${parsed.quantity} ${parsed.unit}`.trim(),
            isApproximate: false,
          }
        : null,
      isMain: false,
      isShoppingListRelevant: true,
      cultivar: null,
    };
  });

  return {
    servings,
    unit: "Personen",
    text: `${servings} Personen`,
    textFull: recipe.recipeYield ?? `Für ${servings} Personen`,
    isDefault: true,
    groups: [{ title: null, ingredients }],
  };
}
