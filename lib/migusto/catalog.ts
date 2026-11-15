import { cacheLife, cacheTag } from "next/cache";
import { migustoFetchHtml } from "./client";
import { extractRecipeRefs } from "./listing";
import type { RecipeRef } from "./types";

/**
 * The recipe browser lives at /de/rezept-uebersicht(/<taxonomy-slug>)?page=N and
 * is server rendered, so the recipe links can be read straight from the HTML.
 */
const OVERVIEW_PATH = "rezept-uebersicht";

export async function listRecipesByTaxonomy(taxonomySlug: string | null, page: number): Promise<RecipeRef[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("migusto:catalog", `migusto:catalog:${taxonomySlug ?? "all"}`);

  const suffix = taxonomySlug ? `/${taxonomySlug}` : "";
  const html = await migustoFetchHtml(`/de/${OVERVIEW_PATH}${suffix}?page=${page}`);
  return extractRecipeRefs(html);
}

export interface CandidatePoolOptions {
  taxonomySlugs: string[];
  /** How many pages per taxonomy to read. */
  pages: number;
  /** Upper bound for the whole pool. */
  limit: number;
}

/**
 * Builds the candidate pool the planner picks from: several taxonomy listings,
 * deduplicated by recipe id.
 */
export async function collectCandidateRefs(options: CandidatePoolOptions): Promise<RecipeRef[]> {
  const requests: Array<Promise<RecipeRef[]>> = [];

  for (const slug of options.taxonomySlugs) {
    for (let page = 1; page <= options.pages; page += 1) {
      requests.push(listRecipesByTaxonomy(slug, page).catch(() => []));
    }
  }

  const results = await Promise.all(requests);
  const seen = new Set<string>();
  const refs: RecipeRef[] = [];

  for (const list of results) {
    for (const ref of list) {
      if (seen.has(ref.id)) {
        continue;
      }
      seen.add(ref.id);
      refs.push(ref);
      if (refs.length >= options.limit) {
        return refs;
      }
    }
  }

  return refs;
}
