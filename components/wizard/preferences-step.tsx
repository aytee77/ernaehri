"use client";

import type { PlanInput, PlanPreferences } from "@/lib/planner/types";
import { StepBudget, StepDays, StepPeople } from "./steps";

const PREFERENCE_FIELDS: Array<{ key: keyof PlanPreferences; label: string; hint: string }> = [
  { key: "quick", label: "Schnell & einfach", hint: "bevorzugt Gerichte bis ca. 30 Minuten" },
  { key: "vegetarian", label: "Vegetarisch", hint: "nur fleischlose Rezepte" },
  { key: "vegan", label: "Vegan", hint: "ohne tierische Produkte" },
  { key: "onSale", label: "Aktionen nutzen", hint: "bevorzugt aktuelle Migusto-Aktionen" },
];

export function StepPreferences({
  value,
  onChange,
}: {
  value: PlanPreferences;
  onChange: (preferences: PlanPreferences) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">Optional: Was soll der Plan berücksichtigen?</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PREFERENCE_FIELDS.map((field) => (
          <label
            key={field.key}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
              value[field.key]
                ? "border-emerald-500 bg-emerald-50"
                : "border-zinc-200 bg-white hover:border-zinc-300"
            }`}
          >
            <input
              type="checkbox"
              checked={value[field.key]}
              onChange={(event) => onChange({ ...value, [field.key]: event.target.checked })}
              className="mt-1 size-4 accent-emerald-600"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900">{field.label}</span>
              <span className="block text-xs text-zinc-500">{field.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export const STEP_TITLES = ["Personen", "Kochtage", "Budget", "Feinschliff"] as const;

export function StepProgress({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex flex-wrap gap-2 text-xs font-medium">
      {STEP_TITLES.map((title, index) => {
        const state = index < step ? "done" : index === step ? "current" : "todo";
        return (
          <li
            key={title}
            className={`flex items-center gap-2 rounded-full px-3 py-1 ${
              state === "current"
                ? "bg-emerald-600 text-white"
                : state === "done"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-zinc-100 text-zinc-500"
            }`}
          >
            <span>{index + 1}</span>
            {title}
          </li>
        );
      })}
    </ol>
  );
}

export function StepBody({
  step,
  input,
  onChange,
}: {
  step: number;
  input: PlanInput;
  onChange: (patch: Partial<PlanInput>) => void;
}) {
  switch (step) {
    case 0:
      return <StepPeople value={input.people} onChange={(people) => onChange({ people })} />;
    case 1:
      return <StepDays value={input.days} onChange={(days) => onChange({ days })} />;
    case 2:
      return <StepBudget value={input.budgetChf} onChange={(budgetChf) => onChange({ budgetChf })} />;
    default:
      return (
        <StepPreferences value={input.preferences} onChange={(preferences) => onChange({ preferences })} />
      );
  }
}
