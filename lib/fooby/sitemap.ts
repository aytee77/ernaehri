import { cacheLife, cacheTag } from "next/cache";
import { humanizeSlug } from "../migusto/flight";
import type { RecipeRef } from "../recipes/types";
import { foobyFetchSitemap } from "./client";

/**
 * FOOBY's sitemap is a single ~5 MB urlset listing every page. Recipe URLs look
 * like /de/rezepte/<id>/<slug>; there are ~8'400 of them.
 */
const SITEMAP_PATH = "/sitemap.xml";
const RECIPE_LOC = /https:\/\/fooby\.ch\/de\/rezepte\/(\d+)\/([a-z0-9-]+)/g;

export async function listFoobyRefs(): Promise<RecipeRef[]> {
  "use cache";
  cacheLife("days");
  cacheTag("fooby:catalog");

  const xml = await foobyFetchSitemap(SITEMAP_PATH);
  const seen = new Set<string>();
  const refs: RecipeRef[] = [];

  for (const match of xml.matchAll(RECIPE_LOC)) {
    const id = match[1];
    const slug = match[2];
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    refs.push({ source: "fooby", id, slug, title: humanizeSlug(slug) });
  }

  return refs;
}
