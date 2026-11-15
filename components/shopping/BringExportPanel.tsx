"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bringStatusAction, exportToBringAction } from "@/app/actions";
import { Button, Chip, Notice, Spinner } from "@/components/ui/primitives";
import { describeBringExport, toBringItems, type BringExportSettings } from "@/lib/bring/export";
import type { BringStatus } from "@/lib/bring/types";
import { useStoredValue, writeStoredValue } from "@/lib/client/persistent-state";
import type { ShoppingList } from "@/lib/shopping/types";

const LIST_KEY = "ernaehri.bring.list.v1";
const OPTIONS_KEY = "ernaehri.bring.options.v1";
/** Module level fallbacks keep the useSyncExternalStore snapshot stable. */
const NO_LIST: string | null = null;
const DEFAULT_OPTIONS: BringExportSettings = { includePantry: false, onlyOpen: true };

/**
 * Exports the shopping list to the Bring! app: the label of every position becomes
 * the item name, the combined amount becomes Bring!'s "specification". Configured
 * through `BRING_EMAIL` / `BRING_PASSWORD` (and optionally `BRING_LIST_NAME`).
 */
export function BringExportPanel({
  list,
  checked,
  onClose,
}: {
  list: ShoppingList;
  checked: Record<string, boolean>;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<BringStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useStoredValue<string | null>(LIST_KEY, NO_LIST);
  const settings = useStoredValue<BringExportSettings>(OPTIONS_KEY, DEFAULT_OPTIONS);

  const items = useMemo(() => toBringItems(list, checked, settings), [list, checked, settings]);
  // A remembered list only counts while it still exists in the account; otherwise the
  // default list (BRING_LIST_NAME) or the first one wins.
  const remembered = status?.lists.find((entry) => entry.listUuid === selected) ?? null;
  const target = remembered?.listUuid ?? status?.defaultListUuid ?? status?.lists[0]?.listUuid ?? null;
  const targetList = status?.lists.find((entry) => entry.listUuid === target) ?? null;
  const willCreate = status !== null && targetList === null && status.createListName !== null;

  const applyStatus = useCallback((result: { ok: boolean; data?: BringStatus; error?: string }) => {
    if (result.ok && result.data) {
      setStatus(result.data);
    } else {
      setError(result.error ?? "Bring! konnte nicht geladen werden.");
    }
    setLoading(false);
  }, []);

  // Bring! lists are fetched when the panel opens. Everything state-changing happens
  // after the first await, so the effect itself never renders synchronously.
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await bringStatusAction();
      if (active) {
        applyStatus(result);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyStatus]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    applyStatus(await bringStatusAction());
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await exportToBringAction({ listUuid: target, items });
    if (result.ok && result.data) {
      setNotice(describeBringExport(result.data.listName, result.data.added.length, result.data.skipped.length));
      // A missing list has just been created, so the chips are reloaded once.
      applyStatus(await bringStatusAction());
    } else {
      setError(result.error ?? "Übertragen an Bring! fehlgeschlagen.");
    }
    setBusy(false);
  };

  const canSend = status !== null && status.configured && (status.lists.length > 0 || willCreate);

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 no-print">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-900">Nach Bring! senden</h3>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Schliessen
        </Button>
      </div>

      {loading && status === null ? <Spinner label="Bring! wird geladen …" /> : null}

      {!loading && status !== null && !status.configured ? (
        <Notice tone="warn">
          Bring! ist nicht konfiguriert. <code className="font-mono">BRING_EMAIL</code> und{" "}
          <code className="font-mono">BRING_PASSWORD</code> in <code className="font-mono">.env.local</code> eintragen
          (siehe README) und die Seite neu laden.
        </Notice>
      ) : null}

      {status?.notice ? <Notice tone="warn">{status.notice}</Notice> : null}
      {error ? (
        <Notice tone="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button variant="secondary" onClick={() => void reload()} disabled={loading}>
              Erneut versuchen
            </Button>
          </div>
        </Notice>
      ) : null}
      {notice ? <Notice tone="info">{notice}</Notice> : null}

      {canSend ? (
        <div className="space-y-3">
          {status.lists.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-amber-900">Liste</span>
              {status.lists.map((entry) => (
                <Chip
                  key={entry.listUuid}
                  active={entry.listUuid === target}
                  onClick={() => writeStoredValue(LIST_KEY, entry.listUuid)}
                  disabled={busy}
                >
                  {entry.name}
                </Chip>
              ))}
            </div>
          ) : null}

          {willCreate ? (
            <p className="text-xs text-amber-900">Die Liste «{status.createListName}» wird beim Senden angelegt.</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-emerald-600"
                checked={settings.onlyOpen}
                onChange={() => writeStoredValue(OPTIONS_KEY, { ...settings, onlyOpen: !settings.onlyOpen })}
              />
              nur offene Positionen
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-emerald-600"
                checked={settings.includePantry}
                onChange={() => writeStoredValue(OPTIONS_KEY, { ...settings, includePantry: !settings.includePantry })}
              />
              Vorrat &amp; Gewürze mitnehmen
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-600">
              {items.length} {items.length === 1 ? "Position" : "Positionen"} werden übertragen – die Menge steht als
              Mengenangabe am Artikel, bereits vorhandene Artikel werden übersprungen.
            </p>
            <Button onClick={() => void send()} disabled={busy || items.length === 0}>
              {busy ? "Wird gesendet …" : `Zu «${targetList?.name ?? status.createListName ?? "Bring!"}» senden`}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
