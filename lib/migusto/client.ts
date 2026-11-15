import type { Lang } from "./types";

const MIGUSTO_ORIGIN = "https://migusto.migros.ch";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const ATTEMPTS = 3;
const TIMEOUT_MS = 20_000;

export class MigustoError extends Error {
  readonly path: string;
  readonly status?: number;

  constructor(message: string, path: string, status?: number) {
    super(message);
    this.name = "MigustoError";
    this.path = path;
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a Migusto page as HTML.
 *
 * Migusto is a Next.js app, so listings are server rendered (recipe links are in
 * the markup) and recipe pages embed both schema.org JSON-LD and the React
 * Server Component payload with the structured ingredient data.
 */
export async function migustoFetchHtml(path: string, lang: Lang = "de"): Promise<string> {
  const url = `${MIGUSTO_ORIGIN}${path}`;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": process.env.MIGUSTO_USER_AGENT ?? DEFAULT_USER_AGENT,
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "accept-language": `${lang}-CH,${lang};q=0.9`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new MigustoError(`Migusto antwortete mit HTTP ${response.status}`, path, response.status);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) {
        await sleep(300 * attempt);
      }
    }
  }

  if (lastError instanceof MigustoError) {
    throw lastError;
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new MigustoError(`Migusto nicht erreichbar: ${reason}`, path);
}
