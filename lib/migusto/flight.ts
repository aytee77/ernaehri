/**
 * Helpers for reading data out of a Migusto recipe page.
 *
 * Migusto is a Next.js app: the recipe page embeds schema.org JSON-LD and the
 * React Server Component ("flight") payload. In the serialised payload every
 * quote appears escaped (`\"key\":`) and every backslash doubled.
 */

function unescapeFlight(fragment: string): string {
  return fragment.replaceAll('\\"', '"').replaceAll("\\\\", "\\");
}

/** Parses the JSON value that follows a key position, if there is one. */
function parseValueAt(source: string, keyEnd: number): unknown | null {
  const startOffset = source.slice(keyEnd).search(/[[{]/);
  if (startOffset === -1) {
    return null;
  }

  const fragment = balancedSlice(source, keyEnd + startOffset);
  if (!fragment) {
    return null;
  }

  try {
    return JSON.parse(unescapeFlight(fragment));
  } catch {
    return null;
  }
}

/** Reads a JSON value out of the RSC payload by its key. */
export function readFlightValue(html: string, key: string): unknown {
  return readFlightValues(html, key)[0] ?? null;
}

/**
 * Collects every JSON value stored under `key` in the payload.
 *
 * A key can appear more than once (React element tuples, prefetched siblings,
 * CSS-in-JS props), so callers pick the candidate that has the expected shape.
 */
export function readFlightValues(html: string, key: string): unknown[] {
  const escaped = `\\"${key}\\":`;
  const values: unknown[] = [];

  let index = html.indexOf(escaped);
  while (index !== -1) {
    const keyEnd = index + escaped.length;
    const value = parseValueAt(html, keyEnd);
    if (value !== null) {
      values.push(value);
    }
    index = html.indexOf(escaped, keyEnd);
  }

  if (values.length > 0) {
    return values;
  }

  const raw = `"${key}":`;
  let rawIndex = html.indexOf(raw);
  while (rawIndex !== -1) {
    const keyEnd = rawIndex + raw.length;
    const value = parseValueAt(html, keyEnd);
    if (value !== null) {
      values.push(value);
    }
    rawIndex = html.indexOf(raw, keyEnd);
  }

  return values;
}

/** Scans a balanced JSON array/object, aware of the escaped quotes around it. */
function balancedSlice(source: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "\\") {
      if (source[i + 1] === '"') {
        inString = !inString;
      }
      i += 1;
      continue;
    }
    if (inString) {
      continue;
    }
    if (ch === "[" || ch === "{") {
      depth += 1;
    } else if (ch === "]" || ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* text helpers                                                                */
/* -------------------------------------------------------------------------- */

export function decodeEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("\\u0026", "&")
    .trim();
}

export function humanizeSlug(slug: string): string {
  const words = slug.split("-").filter(Boolean);
  if (words.length === 0) {
    return slug;
  }
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function parseIsoDuration(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, days, hours, minutes] = match;
  const total = Number(days ?? 0) * 24 * 60 + Number(hours ?? 0) * 60 + Number(minutes ?? 0);
  return total > 0 ? total : null;
}

export function formatDuration(minutes: number | null): string | null {
  if (!minutes) {
    return null;
  }
  if (minutes < 60) {
    return `${minutes} Min.`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`;
}

/* -------------------------------------------------------------------------- */
/* schema.org JSON-LD                                                          */
/* -------------------------------------------------------------------------- */

export interface LdJsonRecipe {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: string | string[];
  totalTime?: string;
  recipeYield?: string;
  recipeCategory?: string;
  recipeCuisine?: string;
  keywords?: string;
  recipeIngredient?: string[];
  recipeInstructions?: Array<{ text?: string } | string>;
  aggregateRating?: {
    ratingValue?: string | number;
    reviewCount?: string | number;
    ratingCount?: string | number;
  };
  suitableForDiet?: string[];
  cookTime?: string;
  nutrition?: Record<string, unknown>;
}

/** Returns the schema.org Recipe object embedded in the page. */
export function extractLdJsonRecipe(html: string): LdJsonRecipe | null {
  const blocks = html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g);
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const entry of list) {
      const candidate = entry as LdJsonRecipe;
      const types = Array.isArray(candidate["@type"]) ? candidate["@type"] : [candidate["@type"]];
      if (types.includes("Recipe")) {
        return candidate;
      }
    }
  }
  return null;
}

export function normalizeImageUrl(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  return [];
}
