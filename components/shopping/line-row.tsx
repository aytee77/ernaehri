"use client";

import Image from "next/image";
import type { ShoppingLine, ShoppingList } from "@/lib/shopping/types";

export function formatChf(value: number | null): string {
  return value === null ? "–" : `${value.toFixed(2)} CHF`;
}

export function asPlainText(list: ShoppingList): string {
  const lines: string[] = ["Einkaufsliste (Ernähri)"];
  for (const group of list.groups) {
    lines.push("", group.name);
    for (const line of group.lines) {
      const amount = line.amountText ? `${line.amountText} ` : "";
      const price = line.priceChf !== null ? ` (${line.priceChf.toFixed(2)} CHF)` : "";
      lines.push(`- ${amount}${line.label}${price}`);
    }
  }
  lines.push("", `Geschätzte Summe: ${list.totalChf.toFixed(2)} CHF`);
  return lines.join("\n");
}

export function ShoppingLineRow({
  line,
  checked,
  onToggle,
}: {
  line: ShoppingLine;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-start gap-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 size-4 shrink-0 accent-emerald-600"
        aria-label={line.label}
      />
      {line.productImage ? (
        <Image
          src={line.productImage}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-lg border border-zinc-100 object-contain"
        />
      ) : (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-zinc-100 bg-zinc-50 text-sm"
          aria-hidden
        >
          🛒
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${checked ? "text-zinc-400 line-through" : "text-zinc-900"}`}>
          {line.amountText ? <span className="mr-2 text-zinc-600">{line.amountText}</span> : null}
          {line.label}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {line.priceSource === "fallback" ? "Schätzpreis" : "Migros-Preis"}
          {line.usedIn.length > 0 ? ` · für ${line.usedIn.join(", ")}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm text-zinc-800">{formatChf(line.priceChf)}</p>
        {line.productUrl ? (
          <a
            href={line.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-700 underline-offset-2 hover:underline"
          >
            Migros ↗
          </a>
        ) : null}
      </div>
    </li>
  );
}
