import type { BringItem } from "./types";

/**
 * The panel round-trips through the browser, so everything arriving at the server
 * action is validated and clamped here – the same defensive style as
 * `sanitizePlan()` in `lib/planner/validate.ts`.
 */
export interface BringExportRequest {
  /** Target list; `null` means "use BRING_LIST_NAME (create it when missing)". */
  listUuid: string | null;
  items: BringItem[];
}

const LIST_UUID_PATTERN = /^[0-9a-fA-F-]{8,64}$/;
const MAX_ITEMS = 200;
const MAX_NAME_LENGTH = 120;
const MAX_SPECIFICATION_LENGTH = 40;

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

export function sanitizeBringExport(raw: unknown): BringExportRequest {
  const value = (raw ?? {}) as { listUuid?: unknown; items?: unknown };
  const listUuid =
    typeof value.listUuid === "string" && LIST_UUID_PATTERN.test(value.listUuid) ? value.listUuid : null;

  if (!Array.isArray(value.items)) {
    throw new Error("Ungültige Bring!-Übertragung.");
  }

  const seen = new Set<string>();
  const items: BringItem[] = [];
  for (const entry of value.items.slice(0, MAX_ITEMS)) {
    const name = clean((entry as BringItem)?.name, MAX_NAME_LENGTH);
    if (name.length === 0) {
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({ name, specification: clean((entry as BringItem)?.specification, MAX_SPECIFICATION_LENGTH) });
  }

  if (items.length === 0) {
    throw new Error("Keine Positionen zum Übertragen ausgewählt.");
  }

  return { listUuid, items };
}
