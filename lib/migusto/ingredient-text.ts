/**
 * The ingredient-line parser moved to `lib/recipes/ingredient-text.ts` so all
 * sources share it. This file stays as a re-export for existing Migusto imports.
 */
export { parseIngredientText, parseServingsFromYield, sizeFromLdJson } from "../recipes/ingredient-text";
export type { ParsedIngredientText } from "../recipes/ingredient-text";
