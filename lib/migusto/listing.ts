import type { RecipeRef } from "./types";
import { decodeEntities, humanizeSlug } from "./flight";

const RECIPE_HREF = /href="\/(?:de|fr|it)\/(?:rezepte|recettes|ricette)\/([a-z0-9][a-z0-9-]*)\/(\d+)"/g;

/**
 * Migusto renders each recipe card with a tracking payload next to the link:
 * &quot;recipe_id&quot;:&quot;39632&quot;,&quot;recipe_name&quot;:&quot;Marroni aus dem Ofen&quot;
 */
const RECIPE_TITLE = new RegExp(
  [
    "(?:&quot;recipe_id&quot;:&quot;(\\d+)&quot;,&quot;recipe_name&quot;:&quot;([^&]+)&quot;)",
    "|",
    '(?:"recipe_id":"(\\d+)","recipe_name":"([^"]+)")',
  ].join(""),
  "g",
);

/** Extracts the recipe cards of a Migusto overview page, in document order. */
export function extractRecipeRefs(html: string): RecipeRef[] {
  const byId = new Map<string, RecipeRef>();

  for (const match of html.matchAll(RECIPE_HREF)) {
    const slug = match[1];
    const id = match[2];
    if (!byId.has(id)) {
      byId.set(id, { source: "migusto", id, slug, title: "" });
    }
  }

  for (const match of html.matchAll(RECIPE_TITLE)) {
    const id = match[1] ?? match[3];
    const title = decodeEntities(match[2] ?? match[4] ?? "");
    const ref = byId.get(id);
    if (ref && title) {
      ref.title = title;
    }
  }

  return [...byId.values()].map((ref) => ({
    ...ref,
    title: ref.title || humanizeSlug(ref.slug),
  }));
}

/** True when a page looks like it really is a Migusto overview page. */
export function looksLikeOverview(html: string): boolean {
  return html.includes("rezept-uebersicht") || /rezepte\/[a-z0-9-]+\/\d+/.test(html);
}
