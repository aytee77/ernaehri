import type { RawMigrosProduct, MigrosProduct } from "./types";
import { migrosApiBase, migrosApiKey, resolveProductImage } from "./client";
import { readSearchCache, storeProducts, writeSearchCache } from "./cache";
import { matchScore, MATCH_MIN_SCORE } from "./match";

const SEARCH_PATH = "/migros/products/v1/public/products";
const TIMEOUT_MS = 12_000;
const MAX_CANDIDATES = 8;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

function mapSearchHit(raw: RawMigrosProduct): MigrosProduct | null {
  if (!raw?.id || !raw.name) {
    return null;
  }
  const leaf = (raw.categories ?? []).reduce(
    (best, category) => ((category.level ?? 0) > (best?.level ?? 0) ? category : best),
    (raw.categories ?? [])[0],
  );

  return {
    uid: raw.id,
    name: raw.name.trim(),
    brand: raw.brand?.name?.trim() ?? null,
    slug: raw.slug ?? null,
    image: resolveProductImage(raw.image_transparent ?? raw.image),
    priceChf: typeof raw.price?.item?.price === "number" ? raw.price.item.price : null,
    basePriceChf: typeof raw.price?.base?.price === "number" ? raw.price.base.price : null,
    baseQuantity: typeof raw.price?.base?.quantity === "number" ? raw.price.base.quantity : null,
    baseUnit: raw.price?.base?.unit ?? null,
    currency: raw.price?.currency ?? null,
    categoryPath: (raw.categories ?? []).map((category) => category.name ?? ""),
    leafCategory: leaf?.name ?? null,
    url: raw.links?.migros_ch?.canonical ?? `https://www.migros.ch/de/product/${raw.id}`,
  };
}

/** Free-text product search on api.migros.ch (same public endpoint Migusto uses). */
export async function searchProducts(query: string, lang = "de"): Promise<MigrosProduct[]> {
  const url = `${migrosApiBase()}${SEARCH_PATH}?limit=${MAX_CANDIDATES}&lang=${lang}&search=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
      "accept-language": lang,
      "x-api-key": migrosApiKey(),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Migros Suche antwortete mit HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { products?: RawMigrosProduct[] };
  return (payload.products ?? [])
    .map(mapSearchHit)
    .filter((product): product is MigrosProduct => product !== null);
}

/**
 * Finds the best matching Migros product for an ingredient name that Migusto
 * did not link to a product itself. Results are cached on disk per name.
 */
export async function findProductForIngredient(name: string, lang = "de"): Promise<MigrosProduct | null> {
  const cached = await readSearchCache(name);
  if (cached) {
    return cached;
  }

  const candidates = await searchProducts(name, lang);
  let best: { product: MigrosProduct; score: number } | null = null;

  for (const product of candidates) {
    const score = matchScore(name, product);
    if (score >= MATCH_MIN_SCORE && (!best || score > best.score)) {
      best = { product, score };
    }
  }

  if (!best) {
    return null;
  }

  await storeProducts([best.product]);
  await writeSearchCache(name, best.product);
  return best.product;
}
