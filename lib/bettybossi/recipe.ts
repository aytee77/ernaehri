import { cacheLife, cacheTag } from "next/cache";
import { buildRecipeFromLdJson } from "../recipes/jsonld";
import type { Recipe } from "../recipes/types";
import { bettybossiFetchHtml } from "./client";

const RECIPE_SEGMENT = "de/rezepte/rezept";

export function bettyBossiSourceUrl(slug: string, id: string): string {
  return `https://www.bettybossi.ch/${RECIPE_SEGMENT}/${slug}-${id}/`;
}

/** Loads (and caches) a Betty Bossi recipe from its schema.org JSON-LD. */
export async function getBettyBossiRecipe(id: string, slug: string): Promise<Recipe> {
  "use cache";
  cacheLife("days");
  cacheTag("bettybossi:recipes", `bettybossi:recipe:${id}`);

  const html = await bettybossiFetchHtml(`/${RECIPE_SEGMENT}/${slug}-${id}/`);
  return buildRecipeFromLdJson(html, {
    source: "bettybossi",
    id,
    slug,
    title: "",
    sourceUrl: bettyBossiSourceUrl(slug, id),
  });
}
