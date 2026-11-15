"use client";

import { useMemo, useState } from "react";
import { Button, Spinner } from "@/components/ui/primitives";
import { useStoredValue, writeStoredValue } from "@/lib/client/persistent-state";
import type { ShoppingList } from "@/lib/shopping/types";
import { BringExportPanel } from "./BringExportPanel";
import { asPlainText, ShoppingLineRow } from "./line-row";

const CHECKED_KEY = "ernaehri.shopping.checked.v1";
const CHECKED_FALLBACK: Record<string, boolean> = {};

export function ShoppingListPanel({
  list,
  loading,
  error,
  onReload,
}: {
  list: ShoppingList | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
}) {
  const checked = useStoredValue<Record<string, boolean>>(CHECKED_KEY, CHECKED_FALLBACK);
  const [copied, setCopied] = useState(false);
  const [showBring, setShowBring] = useState(false);

  const toggle = (key: string) => {
    writeStoredValue(CHECKED_KEY, { ...checked, [key]: !checked[key] });
  };

  const openCount = useMemo(() => {
    if (!list) return 0;
    return list.groups.reduce(
      (sum, group) => sum + group.lines.filter((line) => !checked[line.key]).length,
      0,
    );
  }, [list, checked]);

  if (loading && !list) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <Spinner label="Einkaufsliste wird zusammengestellt …" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p>{error}</p>
        <Button variant="secondary" onClick={onReload}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (!list) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <p className="text-sm text-zinc-600">
          {list.itemCount} Positionen · {openCount} offen · ca. {list.totalChf.toFixed(2)} CHF
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowBring((open) => !open)} disabled={loading}>
            {showBring ? "Bring! schliessen" : "Nach Bring! senden"}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(asPlainText(list));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Kopiert ✓" : "Liste kopieren"}
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Drucken
          </Button>
          <Button variant="ghost" onClick={onReload} disabled={loading}>
            Preise aktualisieren
          </Button>
        </div>
      </div>

      {showBring ? (
        <BringExportPanel list={list} checked={checked} onClose={() => setShowBring(false)} />
      ) : null}

      {list.notice ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {list.notice}
        </p>
      ) : null}

      <div className="space-y-4">
        {list.groups.map((group) => (
          <section key={group.name} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">{group.name}</h3>
            <ul className="divide-y divide-zinc-100">
              {group.lines.map((line) => (
                <ShoppingLineRow
                  key={line.key}
                  line={line}
                  checked={Boolean(checked[line.key])}
                  onToggle={() => toggle(line.key)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-600">Geschätzte Summe (inkl. einmaligem Vorrat)</span>
          <span className="font-semibold text-zinc-900">{list.totalChf.toFixed(2)} CHF</span>
        </div>
        {list.budgetChf !== null ? (
          <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
            <span>Budget {list.budgetChf} CHF</span>
            <span className={list.withinBudget ? "text-emerald-700" : "text-red-600"}>
              {list.withinBudget ? "im Budget" : "über Budget"}
            </span>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500">
          {list.knownPriceCount} Migros-Preise · {list.estimatedPriceCount} Schätzungen
          {list.missingPriceCount > 0 ? ` · ${list.missingPriceCount} ohne Preis` : ""}
        </p>
      </div>
    </div>
  );
}
