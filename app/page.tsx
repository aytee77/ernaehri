import { PlannerWizard } from "@/components/wizard/PlannerWizard";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Ernähri</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          Deine Woche, geplant in zwei Minuten.
        </h1>
        <p className="max-w-2xl text-zinc-600">
          Sag uns, für wie viele Personen du kochst, an welchen Tagen du kochen willst und wie viel du
          ausgeben möchtest. Ernähri stellt daraus einen Wochenplan aus Hauptgerichten von Migusto, Betty
          Bossi und FOOBY zusammen – mit Einkaufsliste und echten Migros-Preisen. Passt ein Gericht nicht,
          tauschst du es mit einem Klick aus oder löschst es.
        </p>
      </header>

      <PlannerWizard />

      <footer className="mt-auto border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        Rezepte stammen von <span className="font-medium">Migusto</span>,{" "}
        <span className="font-medium">Betty Bossi</span> und <span className="font-medium">FOOBY</span>.
        Produkte, Preise und Einkaufsliste stammen von <span className="font-medium">Migros</span>{" "}
        (api.migros.ch) – Richtpreise für die kleinste Packung in CHF.
      </footer>
    </div>
  );
}

