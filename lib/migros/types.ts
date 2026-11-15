export interface MigrosCategory {
  code: string;
  level: number;
  name: string;
  parentCode: string | null;
  slug: string | null;
}

export interface MigrosProduct {
  /** Migros product UID, e.g. "277107901000" (same ids Migusto uses). */
  uid: string;
  name: string;
  brand: string | null;
  slug: string | null;
  image: string | null;
  /** Price of one package/article in CHF. */
  priceChf: number | null;
  /** Price per base unit (e.g. per 100 g). */
  basePriceChf: number | null;
  baseQuantity: number | null;
  baseUnit: string | null;
  currency: string | null;
  categoryPath: string[];
  leafCategory: string | null;
  url: string | null;
}

export type ProductSource = "live" | "cache" | "fallback" | "unavailable";

export interface ProductLookup {
  /** Only products that were found. */
  products: MigrosProduct[];
  /** Which ingredients could not be matched to a product. */
  missingIds: string[];
  source: ProductSource;
  /** Human readable note for the UI (e.g. "Migros API nicht erreichbar"). */
  notice: string | null;
}

export interface RawMigrosProduct {
  id?: string;
  name?: string;
  slug?: string;
  image?: string;
  image_transparent?: string;
  brand?: { name?: string } | null;
  categories?: Array<{
    code?: string;
    level?: number;
    name?: string;
    parent_code?: string;
    slug?: string;
  }>;
  links?: { migros_ch?: { canonical?: string } } | null;
  price?: {
    currency?: string;
    item?: { price?: number } | null;
    base?: { price?: number; quantity?: number; unit?: string } | null;
    estimated_piece_price?: number;
    estimated_piece_weight?: number;
  } | null;
}
