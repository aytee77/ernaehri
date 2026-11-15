/**
 * The Migusto taxonomy slugs we use to build the recipe pool.
 * Verified against https://migusto.migros.ch/de/rezept-kategorien (Nov 2026).
 */
export interface Taxonomy {
  slug: string;
  name: string;
  /** Migusto taxonomy id, when known (matches the ids used in the site's payload). */
  uuid: string | null;
}

export const TAXONOMIES: Record<string, Taxonomy> = {
  hauptgericht: { slug: "hauptgericht", name: "Hauptgericht", uuid: "146208" },
  vorspeise: { slug: "vorspeise", name: "Vorspeise", uuid: "146200" },
  apero: { slug: "apero", name: "Apéro", uuid: "146184" },
  beilagen: { slug: "beilagen", name: "Beilagen", uuid: "146156" },
  suppe: { slug: "suppe", name: "Suppe", uuid: "146188" },
  salat: { slug: "salat", name: "Salat", uuid: "146216" },
  pasta: { slug: "pasta", name: "Pasta", uuid: "146220" },
  risotto: { slug: "risotto", name: "Risotto", uuid: "14679760" },
  auflaufgratin: { slug: "auflaufgratin", name: "Auflauf & Gratin", uuid: "146180" },
  burger: { slug: "burger", name: "Burger", uuid: "14679686" },
  schnelleinfach: { slug: "schnelleinfach", name: "Schnell & einfach", uuid: "147184" },
  familienkinder: { slug: "familienkinder", name: "Familien & Kinder", uuid: "146204" },
  aktionen: { slug: "aktionen", name: "Aktionen", uuid: "DISCOUNTS" },
  fuergaeste: { slug: "fuergaeste", name: "Für Gäste", uuid: "147160" },
  vegetarisch: { slug: "vegetarisch", name: "Vegetarisch", uuid: null },
  vegan: { slug: "vegan", name: "Vegan", uuid: null },
  laktosefrei: { slug: "laktosefrei", name: "Laktosefrei", uuid: null },
  glutenfrei: { slug: "glutenfrei", name: "Glutenfrei", uuid: null },
  gesundausgewogen: { slug: "gesundausgewogen", name: "Gesund & ausgewogen", uuid: null },
  fleisch: { slug: "fleisch", name: "Fleisch", uuid: null },
  gefluegel: { slug: "gefluegel", name: "Geflügel", uuid: null },
  fisch: { slug: "fisch", name: "Fisch", uuid: null },
  gemuese: { slug: "gemuese", name: "Gemüse", uuid: null },
  fruechte: { slug: "fruechte", name: "Früchte", uuid: null },
  min15: { slug: "15min", name: "15 Minuten", uuid: "14679502" },
  min30: { slug: "30min", name: "30 Minuten", uuid: "14679529" },
  min60: { slug: "60min", name: "60 Minuten", uuid: "14679592" },
  schweiz: { slug: "schweiz", name: "Schweizer Küche", uuid: null },
  italien: { slug: "italien", name: "Italien", uuid: null },
  asien: { slug: "asien", name: "Asien", uuid: null },
  orient: { slug: "orient", name: "Orient", uuid: null },
  mexiko: { slug: "mexiko", name: "Mexiko", uuid: null },
  fruehling: { slug: "fruehling", name: "Frühling", uuid: "147164" },
  sommer: { slug: "sommer", name: "Sommer", uuid: "147192" },
  herbst: { slug: "herbst", name: "Herbst", uuid: "147208" },
  winter: { slug: "winter", name: "Winter", uuid: "147212" },
  grillieren: { slug: "grillieren", name: "Grillieren", uuid: "147196" },
};

export function taxonomyName(slug: string): string {
  return TAXONOMIES[slug]?.name ?? slug;
}

/** Taxonomies that can appear as a dinner in a weekly plan. */
export const DINNER_TAXONOMIES = [
  "hauptgericht",
  "auflaufgratin",
  "pasta",
  "risotto",
  "suppe",
] as const;

/** Preference-specific taxonomies, mapped from the wizard's answers. */
export const PREFERENCE_TAXONOMIES = {
  vegetarian: "vegetarisch",
  vegan: "vegan",
  glutenFree: "glutenfrei",
  lactoseFree: "laktosefrei",
  quick: "schnelleinfach",
  onSale: "aktionen",
  family: "familienkinder",
} as const;

/** Migusto's season to bias suggestions (northern hemisphere). */
export function currentSeasonSlug(date = new Date()): string {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "fruehling";
  if (month >= 6 && month <= 8) return "sommer";
  if (month >= 9 && month <= 11) return "herbst";
  return "winter";
}
