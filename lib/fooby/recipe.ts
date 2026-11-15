import { cacheLife, cacheTag } from "next/cache";
import { buildRecipeFromLdJson } from "../recipes/jsonld";
import type { Recipe } from "../recipes/types";
import { foobyFetchHtml } from "./client";

const RECIPE_SEGMENT = "de/rezepte";

export function foobySourceUrl(id: string, slug: string): string {
  return `https://fooby.ch/${RECIPE_SEGMENT}/${id}/${slug}`;
}

/** Loads (and caches) a FOOBY recipe from its schema.org JSON-LD. */
export async function getFoobyRecipe(id: string, slug: string): Promise<Recipe> {
  "use cache";
  cacheLife("days");
  cacheTag("fooby:recipes", `fooby:recipe:${id}`);

  const html = await foobyFetchHtml(`/${RECIPE_SEGMENT}/${id}/${slug}`);
  return buildRecipeFromLdJson(html, {
    source: "fooby",
    id,
    slug,
    title: "",
    sourceUrl: foobySourceUrl(id, slug),
  });
}
