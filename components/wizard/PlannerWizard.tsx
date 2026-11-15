"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateWeekAction,
  regenerateWeekAction,
  removeMealAction,
  shoppingListAction,
  swapMealAction,
} from "@/app/actions";
import { PlanView } from "@/components/plan/PlanView";
import { Button, Card, Notice, Spinner } from "@/components/ui/primitives";
import { useStoredValue, writeStoredValue } from "@/lib/client/persistent-state";
import type { MealPlan, PlanInput, Weekday } from "@/lib/planner/types";
import { DEFAULT_PREFERENCES } from "@/lib/planner/types";
import type { ShoppingList } from "@/lib/shopping/types";
import { StepBody, StepProgress, STEP_TITLES } from "./preferences-step";

const PLAN_KEY = "ernaehri.plan.v1";

const DEFAULT_INPUT: PlanInput = {
  people: 2,
  days: ["mon", "tue", "wed", "thu", "fri"],
  budgetChf: 120,
  preferences: DEFAULT_PREFERENCES,
  lang: "de",
};

export function PlannerWizard() {
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftInput, setDraftInput] = useState<PlanInput | null>(null);
  const [localPlan, setLocalPlan] = useState<MealPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyDay, setBusyDay] = useState<Weekday | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [shoppingError, setShoppingError] = useState<string | null>(null);
  /** Plan id whose shopping list has already been built (or is being built). */
  const loadedPlanId = useRef<string | null>(null);

  // Restores the last plan from localStorage without a hydration mismatch.
  const storedPlan = useStoredValue<MealPlan | null>(PLAN_KEY, null);
  const plan = localPlan ?? storedPlan;
  const input = draftInput ?? plan?.input ?? DEFAULT_INPUT;

  const loadShoppingList = useCallback(async (target: MealPlan) => {
    setShoppingLoading(true);
    setShoppingError(null);
    const result = await shoppingListAction(target);
    if (result.ok && result.data) {
      setShoppingList(result.data);
    } else {
      setShoppingError(result.error ?? "Einkaufsliste konnte nicht erstellt werden.");
    }
    setShoppingLoading(false);
  }, []);

  const applyPlan = useCallback(
    (next: MealPlan) => {
      setLocalPlan(next);
      setEditing(false);
      setDraftInput(next.input);
      writeStoredValue(PLAN_KEY, next);
      loadedPlanId.current = next.id;
      void loadShoppingList(next);
    },
    [loadShoppingList],
  );

  // A plan restored from localStorage comes without prices: build its shopping list
  // once, so the panel (kopieren / drucken / Bring!) is usable right after a reload.
  useEffect(() => {
    if (!storedPlan) {
      return;
    }
    const target = storedPlan;
    // Deferred by one tick – the effect itself must not set state synchronously.
    const timer = setTimeout(() => {
      if (loadedPlanId.current === target.id) {
        return;
      }
      loadedPlanId.current = target.id;
      void loadShoppingList(target);
    }, 0);
    return () => clearTimeout(timer);
  }, [storedPlan, loadShoppingList]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const result = await generateWeekAction(input);
    if (result.ok && result.data) {
      applyPlan(result.data);
    } else {
      setError(result.error ?? "Der Wochenplan konnte nicht erstellt werden.");
    }
    setBusy(false);
  };

  const regenerate = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    const result = await regenerateWeekAction(plan);
    if (result.ok && result.data) {
      applyPlan(result.data);
    } else {
      setError(result.error ?? "Die neue Woche konnte nicht erstellt werden.");
    }
    setBusy(false);
  };

  const swapMeal = async (day: Weekday) => {
    if (!plan) return;
    setBusyDay(day);
    setError(null);
    const result = await swapMealAction(plan, day);
    if (result.ok && result.data) {
      applyPlan(result.data);
    } else {
      setError(result.error ?? "Kein anderes Rezept gefunden.");
    }
    setBusyDay(null);
  };

  const removeMeal = async (day: Weekday) => {
    if (!plan) return;
    setBusyDay(day);
    setError(null);
    const result = await removeMealAction(plan, day);
    if (result.ok && result.data) {
      applyPlan(result.data);
    } else {
      setError(result.error ?? "Das Gericht konnte nicht gelöscht werden.");
    }
    setBusyDay(null);
  };

  if (plan && !editing) {
    return (
      <PlanView
        plan={plan}
        shoppingList={shoppingList}
        shoppingLoading={shoppingLoading}
        shoppingError={shoppingError}
        busy={busy}
        busyDay={busyDay}
        error={error}
        onSwap={swapMeal}
        onRemove={removeMeal}
        onRegenerate={regenerate}
        onEditSettings={() => {
          setDraftInput(plan.input);
          setStep(0);
          setEditing(true);
          setError(null);
        }}
        onReloadShopping={() => void loadShoppingList(plan)}
      />
    );
  }

  return (
    <Card className="p-6">
      <StepProgress step={step} />
      <h2 className="mb-4 text-xl font-semibold text-zinc-900">
        Schritt {step + 1} von {STEP_TITLES.length}: {STEP_TITLES[step]}
      </h2>

      <StepBody step={step} input={input} onChange={(patch) => setDraftInput({ ...input, ...patch })} />

      {error ? (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || busy}
        >
          Zurück
        </Button>

        <div className="flex items-center gap-3">
          {busy ? <Spinner label="Rezepte und Preise werden geladen …" /> : null}
          {plan ? (
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Abbrechen
            </Button>
          ) : null}
          {step < STEP_TITLES.length - 1 ? (
            <Button
              onClick={() => setStep((current) => current + 1)}
              disabled={busy || input.days.length === 0}
            >
              Weiter
            </Button>
          ) : (
            <Button onClick={generate} disabled={busy || input.days.length === 0}>
              Wochenplan erstellen
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
