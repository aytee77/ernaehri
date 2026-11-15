"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A tiny localStorage-backed external store.
 *
 * Using useSyncExternalStore (instead of reading localStorage in an effect)
 * keeps hydration safe and avoids the cascading render that setState-in-effect
 * causes. Pass a module level constant as `fallback` so the snapshot identity
 * stays stable.
 */
const listeners = new Map<string, Set<() => void>>();
const snapshots = new Map<string, { raw: string | null; parsed: unknown }>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function notify(key: string): void {
  const set = listeners.get(key);
  if (set) {
    set.forEach((listener) => listener());
  }
}

function snapshot<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) {
    return cached.parsed === null ? fallback : (cached.parsed as T);
  }

  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  snapshots.set(key, { raw, parsed });
  return parsed === null ? fallback : (parsed as T);
}

export function writeStoredValue<T>(key: string, value: T | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // storage may be unavailable (private mode) – the app keeps working in memory
  }
  snapshots.delete(key);
  notify(key);
}

export function useStoredValue<T>(key: string, fallback: T): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const set = listeners.get(key) ?? new Set<() => void>();
      set.add(onStoreChange);
      listeners.set(key, set);

      const onStorage = (event: StorageEvent) => {
        if (event.key === key) {
          snapshots.delete(key);
          onStoreChange();
        }
      };

      window.addEventListener("storage", onStorage);
      return () => {
        set.delete(onStoreChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(() => snapshot(key, fallback), [key, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
