/**
 * Staples that most kitchens already have. They are listed separately and only
 * counted once in the budget, because you don't rebuy salt every week.
 */
const PANTRY_KEYWORDS = [
  "salz",
  "pfeffer",
  "paprika",
  "muskat",
  "zimt",
  "curry",
  "oregano",
  "thymian",
  "rosmarin",
  "lorbeer",
  "bouillon",
  "hefe",
  "backpulver",
  "natron",
  "mehl",
  "zucker",
  "speisestärke",
  "maisstärke",
  "vanille",
  "safran",
  "gewürz",
  "chili",
  "knoblauchpulver",
  "wasser",
  "essig",
  "sojasauce",
  "senf",
  "ketchup",
  "mayonnaise",
  "öl",
];

const PANTRY_CATEGORY_KEYWORDS = ["gewürz", "kräuter", "öle", "essig", "backzutaten", "bouillon", "konserven"];

export function isPantryItem(name: string, category: string | null): boolean {
  const normalizedName = name.toLowerCase();
  if (PANTRY_KEYWORDS.some((keyword) => normalizedName.includes(keyword))) {
    return true;
  }
  const normalizedCategory = (category ?? "").toLowerCase();
  return PANTRY_CATEGORY_KEYWORDS.some((keyword) => normalizedCategory.includes(keyword));
}

export const PANTRY_GROUP_NAME = "Vorrat & Gewürze";
