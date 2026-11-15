import type { RecipeSource, SourceInfo } from "./types";

/**
 * Source metadata lives in its own module (no fetchers) so client components can
 * import it without pulling in the server-only recipe loaders.
 */
export const SOURCE_INFO: Record<RecipeSource, SourceInfo> = {
  migusto: {
    id: "migusto",
    label: "Migusto",
    linkLabel: "Rezept auf Migusto öffnen",
    homeUrl: "https://migusto.migros.ch/de/rezept-uebersicht",
  },
  bettybossi: {
    id: "bettybossi",
    label: "Betty Bossi",
    linkLabel: "Rezept auf Betty Bossi öffnen",
    homeUrl: "https://www.bettybossi.ch/de/rezepte/",
  },
  fooby: {
    id: "fooby",
    label: "FOOBY",
    linkLabel: "Rezept auf FOOBY öffnen",
    homeUrl: "https://fooby.ch/de.html",
  },
};

/** Every source the planner draws from, in a stable order. */
export const RECIPE_SOURCES: RecipeSource[] = ["migusto", "bettybossi", "fooby"];

export function isRecipeSource(value: unknown): value is RecipeSource {
  return typeof value === "string" && value in SOURCE_INFO;
}

/** Never throws: unknown/missing sources fall back to Migusto. */
export function sourceInfo(source: RecipeSource | string | null | undefined): SourceInfo {
  return (source && SOURCE_INFO[source as RecipeSource]) || SOURCE_INFO.migusto;
}

/** Stable cross-source identity, e.g. "bettybossi:10004767". */
export function recipeKey(value: { source: RecipeSource; id: string }): string {
  return `${value.source}:${value.id}`;
}
