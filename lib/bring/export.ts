import type { ShoppingList } from "../shopping/types";
import type { BringItem } from "./types";

export interface BringExportSettings {
  /** Take the one-off "Vorrat & Gewürze" lines along? */
  includePantry: boolean;
  /** Only export lines that are not ticked off yet? */
  onlyOpen: boolean;
}

/**
 * Turns the shopping list on screen into Bring! items: the line label becomes the
 * item name, the combined amount becomes Bring!'s "specification" (the small line
 * under the item). Pure, so the panel can use it on the client.
 */
export function toBringItems(
  list: ShoppingList,
  checked: Record<string, boolean>,
  settings: BringExportSettings,
): BringItem[] {
  const items: BringItem[] = [];
  const seen = new Set<string>();

  for (const group of list.groups) {
    for (const line of group.lines) {
      if (line.pantry && !settings.includePantry) {
        continue;
      }
      if (settings.onlyOpen && checked[line.key]) {
        continue;
      }

      const name = line.label.trim();
      const key = name.toLowerCase();
      if (name.length === 0 || seen.has(key)) {
        continue;
      }

      seen.add(key);
      items.push({ name, specification: line.amountText.trim() });
    }
  }

  return items;
}

/** Short summary for the panel, e.g. "23 Positionen ergänzt, 2 waren schon drauf". */
export function describeBringExport(listName: string, added: number, skipped: number): string {
  if (added === 0) {
    return skipped > 0
      ? `«${listName}»: alles schon auf der Liste (${skipped} ${skipped === 1 ? "Position" : "Positionen"}).`
      : `«${listName}»: nichts zu übertragen.`;
  }

  const parts = [`«${listName}»: ${added} ${added === 1 ? "Position" : "Positionen"} ergänzt`];
  if (skipped > 0) {
    parts.push(`${skipped} waren bereits auf der Liste`);
  }
  return parts.join(", ");
}
