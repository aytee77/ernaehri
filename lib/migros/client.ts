import type { MigrosCategory, MigrosProduct, ProductLookup, RawMigrosProduct } from "./types";
import { readCachedProducts, storeProducts } from "./cache";

/**
 * api.migros.ch is the gateway behind Migusto's "Zutaten in deiner Migros"
 * widget. `PUBLIC_CLIENT_KEY` is the client key Migusto ships to every browser;
 * both values can be overridden through the environment.
 */
const DEFAULT_API_BASE = "https://api.migros.ch";
const PUBLIC_CLIENT_KEY = "Y0gsoKm0tYyiylLocGWD";
const PRODUCTS_PATH = "/migros/products/v1/public/products";
const MAX_IDS_PER_REQUEST = 25;
const REQUEST_TIMEOUT_MS = 12_000;
const IMAGE_STACK = "2017-medium";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

export function migrosApiBase(): string {
  return (process.env.MIGROS_API_URL ?? DEFAULT_API_BASE).replace(/\/+$/, "");
}

export function migrosApiKey(): string {
  return process.env.MIGROS_API_KEY ?? PUBLIC_CLIENT_KEY;
}

export function isProductId(value: string): boolean {
  return /^\d{6,}$/.test(value);
}

export function resolveProductImage(template?: string | null, stack = IMAGE_STACK): string | null {
  if (!template) {
    return null;
  }
  return template.includes("{stack}") ? template.replace("{stack}", stack) : template;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function mapProduct(raw: RawMigrosProduct): MigrosProduct | null {
  if (!raw?.id || !raw.name) {
    return null;
  }

  const categories: MigrosCategory[] = (raw.categories ?? [])
    .filter((category) => typeof category?.name === "string")
    .map((category) => ({
      code: category.code ?? "",
      level: category.level ?? 0,
      name: category.name as string,
      parentCode: category.parent_code ?? null,
      slug: category.slug ?? null,
    }));

  const byLevel = [...categories].sort((a, b) => a.level - b.level);
  const leaf = byLevel[byLevel.length - 1] ?? null;

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
    categoryPath: byLevel.map((category) => category.name),
    leafCategory: leaf?.name ?? null,
    url: raw.links?.migros_ch?.canonical ?? `https://www.migros.ch/de/product/${raw.id}`,
  };
}

async function fetchProductChunk(ids: string[], lang: string): Promise<RawMigrosProduct[]> {
  const url = `${migrosApiBase()}${PRODUCTS_PATH}?limit=${Math.max(ids.length, 10)}&ids=${ids.join(",")}&lang=${lang}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
      "accept-language": lang,
      "x-api-key": migrosApiKey(),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Migros Produkt-API antwortete mit HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { products?: RawMigrosProduct[] };
  return payload.products ?? [];
}

async function fetchProducts(ids: string[], lang: string): Promise<{ products: MigrosProduct[]; failures: number }> {
  const chunks = chunkArray(ids, MAX_IDS_PER_REQUEST);
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        return { raw: await fetchProductChunk(chunk, lang), failed: false };
      } catch {
        return { raw: [] as RawMigrosProduct[], failed: true };
      }
    }),
  );

  const products: MigrosProduct[] = [];
  let failures = 0;

  for (const result of results) {
    if (result.failed) {
      failures += 1;
      continue;
    }
    for (const raw of result.raw) {
      const product = mapProduct(raw);
      if (product) {
        products.push(product);
      }
    }
  }

  return { products, failures };
}

/**
 * Looks up Migros products (name, price, category, image) for the product UIDs
 * a recipe references. Fresh disk cache first, then the live API, then stale
 * cache values, so a Migros outage degrades instead of failing.
 */
export async function getProducts(ids: string[], lang = "de"): Promise<ProductLookup> {
  const unique = [...new Set(ids.filter(isProductId))];
  if (unique.length === 0) {
    return { products: [], missingIds: [], source: "cache", notice: null };
  }

  const cached = await readCachedProducts(unique, { allowStale: false });
  if (cached.missingIds.length === 0) {
    return { products: cached.products, missingIds: [], source: "cache", notice: null };
  }

  try {
    const { products, failures } = await fetchProducts(cached.missingIds, lang);
    await storeProducts(products);

    const all = [...cached.products, ...products];
    const found = new Set(all.map((product) => product.uid));

    return {
      products: all,
      missingIds: unique.filter((id) => !found.has(id)),
      source: "live",
      notice: failures > 0 ? `${failures} Migros-Anfrage(n) fehlgeschlagen – Preise unvollständig.` : null,
    };
  } catch (error) {
    const stale = await readCachedProducts(unique, { allowStale: true });
    const reason = error instanceof Error ? error.message : String(error);
    return {
      products: stale.products,
      missingIds: stale.missingIds,
      source: stale.products.length > 0 ? "cache" : "unavailable",
      notice: `Migros-Preis-API nicht erreichbar (${reason}). Preise fehlen oder sind veraltet.`,
    };
  }
}
