/**
 * The recipe model is now shared by every source and lives in
 * `lib/recipes/types.ts`. This file stays as a re-export so existing imports
 * from `lib/migusto/types` keep working unchanged.
 */
export * from "../recipes/types";
