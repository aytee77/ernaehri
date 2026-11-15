"use client";

import { Button, Notice } from "@/components/ui/primitives";
import { ShoppingListPanel } from "@/components/shopping/ShoppingListPanel";
import type { MealPlan, Weekday } from "@/lib/planner/types";
import type { ShoppingList } from "@/lib/shopping/types";
import { BudgetBar } from "./BudgetBar";
import { MealCard } from "./MealCard";

export function PlanView({
  plan,
  shoppingList,
  shoppingLoading,
  shoppingError,
  busy,
  busyDay,
  error,
  onSwap,
  onRemove,
  onRegenerate,
  onEditSettings,
  onReloadShopping,
}: {
  plan: MealPlan;
  shoppingList: ShoppingList | null;
  shoppingLoading: boolean;
  shoppingError: string | null;
  busy: boolean;
  busyDay: Weekday | null;
  error: string | null;
  onSwap: (day: Weekday) => void;
  onRemove: (day: Weekday) => void;
  onRegenerate: () => void;
  onEditSettings: () => void;
  onReloadShopping: () => void;
}) {
  const cheapest = plan.meals.reduce<number | null>(
    (best, meal) => (meal.estimatedCostChf === null ? best : Math.min(best ?? Infinity, meal.estimatedCostChf)),
    null,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
            {plan.input.people} {plan.input.people === 1 ? "Person" : "Personen"}
          </span>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
            {plan.meals.length} {plan.meals.length === 1 ? "Gericht" : "Gerichte"}
          </span>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
            Budget {plan.input.budgetChf} CHF
          </span>
          {plan.input.preferences.vegetarian ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">vegetarisch</span>
          ) : null}
          {plan.input.preferences.vegan ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">vegan</span>
          ) : null}
          {plan.input.preferences.quick ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">schnell</span>
          ) : null}
          {plan.input.preferences.onSale ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">Aktionen</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onRegenerate} disabled={busy}>
            Ganze Woche neu
          </Button>
          <Button variant="secondary" onClick={onEditSettings} disabled={busy}>
            Einstellungen ändern
          </Button>
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {plan.priceNotice ? <Notice tone="warn">{plan.priceNotice}</Notice> : null}

      <BudgetBar
        total={plan.estimatedTotalChf}
        budget={plan.budgetChf}
        priceNotice={cheapest === null ? "Keine Preise verfügbar" : null}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Deine Woche</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plan.meals.map((meal) => (
            <MealCard
              key={meal.day}
              meal={meal}
              busy={busy || busyDay === meal.day}
              onSwap={() => onSwap(meal.day)}
              onRemove={() => onRemove(meal.day)}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          „Anderes Rezept“ tauscht nur diesen Tag, „Löschen“ nimmt das Gericht aus Plan und Einkaufsliste.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Einkaufsliste</h2>
        <ShoppingListPanel
          list={shoppingList}
          loading={shoppingLoading}
          error={shoppingError}
          onReload={onReloadShopping}
        />
      </section>
    </div>
  );
}
