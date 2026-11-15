import { fetchText } from "../recipes/http";

const ORIGIN = "https://www.bettybossi.ch";
const HTML_ACCEPT = "text/html,application/xhtml+xml,*/*;q=0.8";
const XML_ACCEPT = "application/xml,text/xml,*/*;q=0.8";
const ACCEPT_LANGUAGE = "de-CH,de;q=0.9";

/**
 * Betty Bossi recipe pages are server rendered with a schema.org JSON-LD block,
 * so no JavaScript is needed to read them. Listing pages are client rendered,
 * which is why the candidate pool comes from the recipe sitemap instead.
 */
export async function bettybossiFetchHtml(path: string): Promise<string> {
  return fetchText(`${ORIGIN}${path}`, {
    accept: HTML_ACCEPT,
    acceptLanguage: ACCEPT_LANGUAGE,
    userAgent: process.env.BETTYBOSSI_USER_AGENT,
  });
}

export async function bettybossiFetchSitemap(path: string): Promise<string> {
  return fetchText(`${ORIGIN}${path}`, {
    accept: XML_ACCEPT,
    acceptLanguage: ACCEPT_LANGUAGE,
    userAgent: process.env.BETTYBOSSI_USER_AGENT,
    timeoutMs: 40_000,
  });
}
