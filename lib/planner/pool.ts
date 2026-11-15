import { listRecipesByTaxonomy } from "../migusto/catalog";
import { PREFERENCE_TAXONOMIES } from "../migusto/taxonomy";
import type { PlanPreferences } from "./types";

export interface PoolEntry {
  id: string;
  slug: string;
  title: string;
  /** Every taxonomy listing this recipe showed up in. */
  taxonomies: Set<string>;
}

/** Reads the given taxonomy listings and merges them into one candidate pool. */
export async function buildPool(taxonomySlugs: string[], pages: number): Promise<PoolEntry[]> {
  const requests: Array<{ slug: string; page: number }> = [];
  for (const slug of taxonomySlugs) {
    for (let page = 1; page <= pages; page += 1) {
      requests.push({ slug, page });
    }
  }

  const results = await Promise.all(
    requests.map(async ({ slug, page }) => ({
      slug,
      refs: await listRecipesByTaxonomy(slug, page).catch(() => []),
    })),
  );

  const pool = new Map<string, PoolEntry>();
  for (const { slug, refs } of results) {
    for (const ref of refs) {
      const existing = pool.get(ref.id);
      if (existing) {
        existing.taxonomies.add(slug);
        if (!existing.title) {
          existing.title = ref.title;
        }
      } else {
        pool.set(ref.id, { id: ref.id, slug: ref.slug, title: ref.title, taxonomies: new Set([slug]) });
      }
    }
  }

  return [...pool.values()];
}

/** Applies the wizard's dietary/time preferences to the pool. */
export function filterByPreferences(entries: PoolEntry[], preferences: PlanPreferences): PoolEntry[] {
  let filtered = entries;

  if (preferences.vegan) {
    const vegan = filtered.filter((entry) => entry.taxonomies.has(PREFERENCE_TAXONOMIES.vegan));
    filtered = vegan.length > 0 ? vegan : filtered;
  } else if (preferences.vegetarian) {
    const vegetarian = filtered.filter(
      (entry) =>
        entry.taxonomies.has(PREFERENCE_TAXONOMIES.vegetarian) ||
        entry.taxonomies.has(PREFERENCE_TAXONOMIES.vegan),
    );
    filtered = vegetarian.length > 0 ? vegetarian : filtered;
  }

  if (preferences.quick) {
    const quick = filtered.filter((entry) => entry.taxonomies.has(PREFERENCE_TAXONOMIES.quick));
    filtered = quick.length > 0 ? quick : filtered;
  }

  return filtered;
}

export function isOnSale(entry: PoolEntry): boolean {
  return entry.taxonomies.has(PREFERENCE_TAXONOMIES.onSale);
}
