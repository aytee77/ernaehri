import { promises as fs } from "node:fs";
import path from "node:path";
import type { MigrosProduct } from "./types";

const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "products.json");
const SEARCH_FILE = path.join(CACHE_DIR, "product-search.json");
/** Migros product/price cache: refetch at most once a week. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  product: MigrosProduct;
  fetchedAt: string;
}

type CacheFile = Record<string, CacheEntry>;

interface SearchEntry {
  uid: string;
  product: MigrosProduct;
  fetchedAt: string;
}

type SearchFile = Record<string, SearchEntry>;

/** Key for the "ingredient name → product" search cache. */
export function searchCacheKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

let writeQueue: Promise<void> = Promise.resolve();

async function readCacheFile(): Promise<CacheFile> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as CacheFile) : {};
  } catch {
    return {};
  }
}

async function writeCacheFile(target: string, file: CacheFile | SearchFile): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(target, JSON.stringify(file, null, 2), "utf8");
  } catch {
    // The cache is best effort: a read-only filesystem must not break the app.
  }
}

export function isFresh(entry: CacheEntry, now = Date.now()): boolean {
  const fetched = Date.parse(entry.fetchedAt);
  return Number.isFinite(fetched) && now - fetched < TTL_MS;
}

/** Cached products, optionally allowing stale entries as a fallback. */
export async function readCachedProducts(
  ids: string[],
  options: { allowStale: boolean },
): Promise<{ products: MigrosProduct[]; missingIds: string[] }> {
  const file = await readCacheFile();
  const products: MigrosProduct[] = [];
  const missingIds: string[] = [];

  for (const id of ids) {
    const entry = file[id];
    if (entry && (options.allowStale || isFresh(entry))) {
      products.push(entry.product);
    } else {
      missingIds.push(id);
    }
  }

  return { products, missingIds };
}

/** Stores freshly fetched products in the on-disk cache. */
export async function storeProducts(products: MigrosProduct[]): Promise<void> {
  if (products.length === 0) {
    return;
  }
  writeQueue = writeQueue.then(async () => {
    const file = await readCacheFile();
    const fetchedAt = new Date().toISOString();
    for (const product of products) {
      file[product.uid] = { product, fetchedAt };
    }
    await writeCacheFile(CACHE_FILE, file);
  });
  await writeQueue;
}

/* -------------------------------------------------------------------------- */
/* "ingredient name → product" search cache                                    */
/* -------------------------------------------------------------------------- */

async function readSearchFile(): Promise<SearchFile> {
  try {
    const raw = await fs.readFile(SEARCH_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as SearchFile) : {};
  } catch {
    return {};
  }
}

export async function readSearchCache(query: string): Promise<MigrosProduct | null> {
  const file = await readSearchFile();
  const entry = file[searchCacheKey(query)];
  if (!entry) {
    return null;
  }
  const fetched = Date.parse(entry.fetchedAt);
  return Number.isFinite(fetched) && Date.now() - fetched < TTL_MS ? entry.product : null;
}

export async function writeSearchCache(query: string, product: MigrosProduct): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const file = await readSearchFile();
    file[searchCacheKey(query)] = { uid: product.uid, product, fetchedAt: new Date().toISOString() };
    await writeCacheFile(SEARCH_FILE, file);
  });
  await writeQueue;
}
