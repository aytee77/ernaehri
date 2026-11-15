const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

export class SourceFetchError extends Error {
  readonly url: string;
  readonly status?: number;

  constructor(message: string, url: string, status?: number) {
    super(message);
    this.name = "SourceFetchError";
    this.url = url;
    this.status = status;
  }
}

export interface FetchOptions {
  accept?: string;
  acceptLanguage?: string;
  attempts?: number;
  timeoutMs?: number;
  userAgent?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a recipe source (Betty Bossi, FOOBY, …) as text with a small retry
 * budget. Recipe pages are server rendered, so the markup — including the
 * schema.org JSON-LD — can be read straight from the response.
 */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 25_000;
  const headers: Record<string, string> = {
    "user-agent": options.userAgent ?? DEFAULT_USER_AGENT,
    accept: options.accept ?? "text/html,application/xhtml+xml,*/*;q=0.8",
  };
  if (options.acceptLanguage) {
    headers["accept-language"] = options.acceptLanguage;
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        throw new SourceFetchError(`Quelle antwortete mit HTTP ${response.status}`, url, response.status);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(400 * attempt);
      }
    }
  }

  if (lastError instanceof SourceFetchError) {
    throw lastError;
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new SourceFetchError(`Quelle nicht erreichbar: ${reason}`, url);
}

/** Runs `task` over `items` with a small concurrency limit (politeness for slow sites). */
export async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += limit) {
    const batch = items.slice(index, index + limit);
    results.push(...(await Promise.all(batch.map((item) => task(item)))));
  }
  return results;
}
