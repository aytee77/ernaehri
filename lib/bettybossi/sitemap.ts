import { cacheLife, cacheTag } from "next/cache";
import { humanizeSlug } from "../migusto/flight";
import type { RecipeRef } from "../recipes/types";
import { bettybossiFetchSitemap } from "./client";

/**
 * The recipe sitemap is the reliable way to enumerate Betty Bossi recipes: the
 * search/category pages load their cards through Algolia at runtime.
 * ~7'400 entries, robots.txt advertises this sitemap.
 */
const SITEMAP_PATH = "/sitemap-recipe-de.xml";
const RECIPE_LOC =
  /<loc>https:\/\/www\.bettybossi\.ch\/de\/rezepte\/rezept\/([a-z0-9][a-z0-9-]*)-(\d+)\/<\/loc>/g;

export async function listBettyBossiRefs(): Promise<RecipeRef[]> {
  "use cache";
  cacheLife("days");
  cacheTag("bettybossi:catalog");

  const xml = await bettybossiFetchSitemap(SITEMAP_PATH);
  const seen = new Set<string>();
  const refs: RecipeRef[] = [];

  for (const match of xml.matchAll(RECIPE_LOC)) {
    const slug = match[1];
    const id = match[2];
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    refs.push({ source: "bettybossi", id, slug, title: humanizeSlug(slug) });
  }

  return refs;
}
