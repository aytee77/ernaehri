import Image from "next/image";
import { Button } from "@/components/ui/primitives";
import { sourceInfo } from "@/lib/recipes/sources";
import type { PlannedMeal } from "@/lib/planner/types";

const PRICE_SOURCE_LABEL: Record<PlannedMeal["priceSource"], string> = {
  live: "Migros-Preis",
  cache: "Migros-Preis (Cache)",
  fallback: "Schätzung",
  unavailable: "kein Preis",
};

function formatChf(value: number | null): string {
  if (value === null) {
    return "–";
  }
  return `${value.toFixed(2)} CHF`;
}

export function MealCard({
  meal,
  busy,
  onSwap,
  onRemove,
}: {
  meal: PlannedMeal;
  busy: boolean;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const source = sourceInfo(meal.source);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] w-full bg-zinc-100">
        {meal.image ? (
          <Image
            src={meal.image}
            alt={meal.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl" aria-hidden>
            🍽️
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-zinc-800 shadow">
          {meal.dayLabel}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-zinc-600 shadow">
          {source.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-semibold leading-snug text-zinc-900">{meal.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            {meal.totalTimeText ? <span>⏱ {meal.totalTimeText}</span> : null}
            {meal.rating !== null ? <span>★ {meal.rating.toFixed(1)}</span> : null}
            <span>{meal.recipeServings} Personen</span>
          </p>
        </div>

        <div className="mt-auto space-y-3">
          <p className="flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-900">{formatChf(meal.estimatedCostChf)}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
              {PRICE_SOURCE_LABEL[meal.priceSource]}
            </span>
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onSwap} disabled={busy} title="Anderes Rezept für diesen Tag">
              Anderes Rezept
            </Button>
            <Button variant="danger" onClick={onRemove} disabled={busy} title="Gericht aus dem Plan löschen">
              Löschen
            </Button>
          </div>

          <a
            href={meal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            {source.linkLabel} ↗
          </a>
        </div>
      </div>
    </article>
  );
}
