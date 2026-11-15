"use client";

import { Chip } from "@/components/ui/primitives";
import type { Weekday } from "@/lib/planner/types";
import { WEEKDAYS } from "@/lib/planner/types";

const PEOPLE_PRESETS = [1, 2, 3, 4, 5, 6, 8];
const BUDGET_PRESETS = [80, 120, 160, 200, 250];

export function StepPeople({ value, onChange }: { value: number; onChange: (people: number) => void }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-600">Für wie viele Personen soll die Woche geplant werden?</p>
      <div className="flex flex-wrap gap-2">
        {PEOPLE_PRESETS.map((people) => (
          <Chip key={people} active={people === value} onClick={() => onChange(people)}>
            {people} {people === 1 ? "Person" : "Personen"}
          </Chip>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm text-zinc-600">
        Andere Anzahl
        <input
          type="number"
          min={1}
          max={12}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? Math.min(12, Math.max(1, Math.round(next))) : 1);
          }}
          className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
        />
        Personen
      </label>
    </div>
  );
}

export function StepDays({ value, onChange }: { value: Weekday[]; onChange: (days: Weekday[]) => void }) {
  const toggle = (day: Weekday) => {
    const next = value.includes(day) ? value.filter((entry) => entry !== day) : [...value, day];
    onChange(WEEKDAYS.map((entry) => entry.id).filter((id) => next.includes(id)));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-600">An welchen Tagen kochst du diese Woche?</p>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => (
          <Chip key={day.id} active={value.includes(day.id)} onClick={() => toggle(day.id)}>
            {day.label}
          </Chip>
        ))}
      </div>
      <div className="flex gap-3 text-sm">
        <button
          type="button"
          onClick={() => onChange(WEEKDAYS.map((day) => day.id))}
          className="text-emerald-700 underline-offset-2 hover:underline"
        >
          Ganze Woche
        </button>
        <button
          type="button"
          onClick={() => onChange(["mon", "tue", "wed", "thu", "fri"])}
          className="text-emerald-700 underline-offset-2 hover:underline"
        >
          Nur Montag–Freitag
        </button>
      </div>
      {value.length === 0 ? (
        <p className="text-sm text-amber-700">Bitte mindestens einen Tag auswählen.</p>
      ) : null}
    </div>
  );
}

export function StepBudget({ value, onChange }: { value: number; onChange: (budget: number) => void }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-600">
        Wie viel möchtest du für die Einkäufe der Woche ausgeben? (Migros-Preise in CHF)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {BUDGET_PRESETS.map((budget) => (
          <Chip key={budget} active={budget === value} onClick={() => onChange(budget)}>
            {budget} CHF
          </Chip>
        ))}
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="number"
            min={20}
            max={500}
            step={5}
            value={value}
            onChange={(event) => {
              const next = Number(event.target.value);
              onChange(Number.isFinite(next) ? Math.min(500, Math.max(20, Math.round(next))) : 20);
            }}
            className="w-28 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-emerald-500 focus:outline-none"
          />
          CHF
        </label>
      </div>
    </div>
  );
}
