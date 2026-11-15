import { fetchText } from "../recipes/http";

const ORIGIN = "https://fooby.ch";
const HTML_ACCEPT = "text/html,application/xhtml+xml,*/*;q=0.8";
const XML_ACCEPT = "application/xml,text/xml,*/*;q=0.8";
const ACCEPT_LANGUAGE = "de-CH,de;q=0.9";

/**
 * FOOBY (Coop) recipe pages are server rendered with a schema.org JSON-LD block.
 * Category pages render through `hawaii_search.sri`, which robots.txt disallows,
 * so the candidate pool comes from the (large, slow) sitemap instead.
 */
export async function foobyFetchHtml(path: string): Promise<string> {
  return fetchText(`${ORIGIN}${path}`, {
    accept: HTML_ACCEPT,
    acceptLanguage: ACCEPT_LANGUAGE,
    userAgent: process.env.FOOBY_USER_AGENT,
  });
}

export async function foobyFetchSitemap(path: string): Promise<string> {
  return fetchText(`${ORIGIN}${path}`, {
    accept: XML_ACCEPT,
    acceptLanguage: ACCEPT_LANGUAGE,
    userAgent: process.env.FOOBY_USER_AGENT,
    // The FOOBY sitemap is ~5 MB and slow to generate.
    timeoutMs: 60_000,
  });
}
