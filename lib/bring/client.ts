import type { BringItem, BringList, BringSession, RawBringAuth, RawBringItems, RawBringLists } from "./types";

/**
 * api.getbring.com is the (unofficial) backend of the Bring! shopping list app.
 * `PUBLIC_CLIENT_KEY` is the client key the Bring! web app ships to every browser;
 * base URL and key can be overridden through the environment, exactly like the
 * Migros product API (see `lib/migros/client.ts`).
 */
const DEFAULT_API_BASE = "https://api.getbring.com/rest/v2";
const PUBLIC_CLIENT_KEY = "cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp";
const DEFAULT_COUNTRY = "CH";
const DEFAULT_CLIENT = "webApp";

const REQUEST_TIMEOUT_MS = 15_000;
/** Bring! access tokens are short lived; re-login well before they expire. */
const SESSION_TTL_MS = 20 * 60_000;
/** Bring! has no documented rate limit – one request at a time is plenty. */
const ITEM_DELAY_MS = 250;
const ATTEMPTS = 3;

export class BringError extends Error {
  readonly path: string;
  readonly status?: number;

  constructor(message: string, path: string, status?: number) {
    super(message);
    this.name = "BringError";
    this.path = path;
    this.status = status;
  }
}

export function bringApiBase(): string {
  return (process.env.BRING_API_URL ?? DEFAULT_API_BASE).replace(/\/+$/, "");
}

export function bringApiKey(): string {
  return process.env.BRING_API_KEY ?? PUBLIC_CLIENT_KEY;
}

export function bringCountry(): string {
  return process.env.BRING_COUNTRY ?? DEFAULT_COUNTRY;
}

function bringClient(): string {
  return process.env.BRING_CLIENT ?? DEFAULT_CLIENT;
}

/** The Bring! account the export pushes to (stays on the server). */
export function bringCredentials(): { email: string; password: string } | null {
  const email = process.env.BRING_EMAIL?.trim();
  const password = process.env.BRING_PASSWORD;
  return email && password ? { email, password } : null;
}

export function isBringConfigured(): boolean {
  return bringCredentials() !== null;
}

/** The list new items are pushed to unless the UI picks another one. */
export function bringDefaultListName(): string | null {
  const name = process.env.BRING_LIST_NAME?.trim();
  return name ? name : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseHeaders(): Record<string, string> {
  const client = bringClient();
  const headers: Record<string, string> = {
    "x-bring-api-key": bringApiKey(),
    "x-bring-client": client,
    "x-bring-client-source": client,
    "x-bring-country": bringCountry(),
    accept: "application/json",
  };
  if (client !== DEFAULT_CLIENT) {
    headers["x-bring-application"] = "bring";
  }
  return headers;
}

function sessionHeaders(session: BringSession): Record<string, string> {
  return {
    ...baseHeaders(),
    authorization: `Bearer ${session.accessToken}`,
    "x-bring-user-uuid": session.uuid,
  };
}

/** Parses a JSON body, tolerating the empty bodies Bring! answers with 204. */
async function parseJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function describeError(payload: RawBringAuth | null, status: number): string {
  const detail = payload?.message ?? payload?.error_description ?? payload?.error;
  return detail ? `Bring! antwortete mit HTTP ${status}: ${detail}` : `Bring! antwortete mit HTTP ${status}`;
}

/** One HTTP call with a timeout. `retry` stays off for writes: they are not idempotent. */
async function send(path: string, init: RequestInit, retry: boolean): Promise<Response> {
  const url = `${bringApiBase()}${path}`;
  const attempts = retry ? ATTEMPTS : 1;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) {
        const status = response.status;
        const message = status < 500 ? describeError(await parseJson<RawBringAuth>(response), status) : `Bring! antwortete mit HTTP ${status}`;
        throw new BringError(message, path, status);
      }
      return response;
    } catch (error) {
      lastError = error;
      // A concrete 4xx answer is final – retrying only makes it worse.
      if (error instanceof BringError && error.status !== undefined && error.status < 500) {
        throw error;
      }
      if (attempt < attempts) {
        await sleep(300 * attempt);
      }
    }
  }

  if (lastError instanceof BringError) {
    throw lastError;
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new BringError(`Bring! nicht erreichbar: ${reason}`, path);
}

let cachedSession: { session: BringSession; expiresAt: number } | null = null;

/** Logs in (or reuses a fresh token) and returns the session. */
export async function bringSession(force = false): Promise<BringSession> {
  if (!force && cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession.session;
  }

  const credentials = bringCredentials();
  if (!credentials) {
    throw new BringError("Bring! ist nicht konfiguriert (BRING_EMAIL / BRING_PASSWORD fehlen).", "/bringauth");
  }

  const response = await send(
    "/bringauth",
    {
      method: "POST",
      headers: { ...baseHeaders(), "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: new URLSearchParams({ email: credentials.email, password: credentials.password }),
    },
    true,
  );

  const payload = await parseJson<RawBringAuth>(response);
  if (!payload?.access_token || !payload.uuid) {
    throw new BringError(
      payload?.message ??
        "Bring! Login lieferte kein Token. Konten mit Google-/Apple-Login haben kein Passwort.",
      "/bringauth",
      response.status,
    );
  }

  const session: BringSession = {
    uuid: payload.uuid,
    name: payload.name ?? "",
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
  };
  cachedSession = { session, expiresAt: Date.now() + SESSION_TTL_MS };
  return session;
}

export function resetBringSession(): void {
  cachedSession = null;
}

/** Authorised GET; an expired token triggers exactly one re-login. */
async function get<T>(path: string): Promise<T | null> {
  const response = await send(path, { headers: sessionHeaders(await bringSession()) }, true);
  return await parseJson<T>(response);
}

/** All Bring! lists of the configured account. */
export async function listBringLists(): Promise<BringList[]> {
  const session = await bringSession();
  let payload: RawBringLists | null;
  try {
    payload = await get<RawBringLists>(`/bringusers/${session.uuid}/lists`);
  } catch (error) {
    if (!(error instanceof BringError) || error.status !== 401) {
      throw error;
    }
    resetBringSession();
    payload = await get<RawBringLists>(`/bringusers/${(await bringSession(true)).uuid}/lists`);
  }

  return (payload?.lists ?? [])
    .filter(
      (list): list is { listUuid: string; name: string; theme?: string } =>
        Boolean(list?.listUuid && list?.name),
    )
    .map((list) => ({ listUuid: list.listUuid, name: list.name, theme: list.theme ?? null }));
}

/** Lower-cased names of everything already on the list (bought items included). */
export async function listBringItemNames(listUuid: string): Promise<Set<string>> {
  const payload = await get<RawBringItems>(`/bringlists/${listUuid}`);
  const names = [...(payload?.purchase ?? []), ...(payload?.recently ?? [])]
    .map((item) => item?.name?.trim().toLowerCase())
    .filter((name): name is string => Boolean(name));
  return new Set(names);
}

/**
 * Adds (or merges) one item on a Bring! list. The API takes form fields and
 * answers with 204 No Content.
 */
export async function addBringItem(listUuid: string, item: BringItem): Promise<void> {
  await send(
    `/bringlists/${listUuid}`,
    {
      method: "PUT",
      headers: {
        ...sessionHeaders(await bringSession()),
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: new URLSearchParams({
        purchase: item.name,
        recently: "",
        specification: item.specification,
        remove: "",
        sender: "null",
      }),
    },
    false,
  );
}

/** Adds items one after the other – Bring! does not like parallel writes. */
export async function addBringItems(
  listUuid: string,
  items: BringItem[],
  existing: Set<string> = new Set(),
): Promise<{ added: string[]; skipped: string[] }> {
  const added: string[] = [];
  const skipped: string[] = [];
  const seen = new Set(existing);

  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) {
      skipped.push(item.name);
      continue;
    }

    if (added.length > 0) {
      await sleep(ITEM_DELAY_MS);
    }
    await addBringItem(listUuid, item);
    seen.add(key);
    added.push(item.name);
  }

  return { added, skipped };
}

/** Creates a list under a client generated UUID (Bring! accepts any UUID here). */
export async function createBringList(name: string, theme = "standard"): Promise<BringList> {
  const listUuid = crypto.randomUUID();
  await send(
    `/bringlists/${listUuid}`,
    {
      method: "PUT",
      headers: { ...sessionHeaders(await bringSession()), "content-type": "application/json" },
      body: JSON.stringify({ name, theme }),
    },
    false,
  );
  return { listUuid, name, theme };
}

/** Resolves `BRING_LIST_NAME` against the account's lists. */
export function matchDefaultList(lists: BringList[]): string | null {
  const wanted = bringDefaultListName()?.toLowerCase();
  if (!wanted) {
    return null;
  }
  return lists.find((list) => list.name.trim().toLowerCase() === wanted)?.listUuid ?? null;
}
