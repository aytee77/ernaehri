export function BudgetBar({
  total,
  budget,
  priceNotice,
}: {
  total: number | null;
  budget: number;
  priceNotice?: string | null;
}) {
  if (total === null) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
        Preise konnten nicht ermittelt werden.
      </div>
    );
  }

  const ratio = budget > 0 ? Math.min(1.25, total / budget) : 0;
  const over = total > budget;
  const percent = Math.round((total / (budget || 1)) * 100);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-zinc-600">
          Geschätzte Einkaufssumme
          {priceNotice ? <span className="ml-2 text-xs text-amber-700">{priceNotice}</span> : null}
        </p>
        <p className="text-lg font-semibold text-zinc-900">
          {total.toFixed(2)} CHF
          <span className="ml-2 text-sm font-normal text-zinc-500">von {budget} CHF</span>
        </p>
      </div>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>

      <p className={`mt-2 text-sm ${over ? "text-red-600" : "text-emerald-700"}`}>
        {over
          ? `Rund ${(total - budget).toFixed(2)} CHF über dem Budget (${percent} %).`
          : `Im Budget – ${(budget - total).toFixed(2)} CHF Reserve (${percent} % genutzt).`}
      </p>
    </div>
  );
}
