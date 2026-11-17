import type { BrowserHandle } from "./browser-handle.js";
import { OriginRefusedError, isAllowedUrl } from "./origin-allowlist.js";

/** The longest a page may take to load. */
const NAVIGATION_TIMEOUT_MS = 10_000;
/** How much of the page's text the model reads. */
const MAX_TEXT_CHARS = 8_000;

/** A page as the model reads it. */
export interface PageContent {
  readonly title: string;
  readonly text: string;
}

/**
 * Reads a page in the shared browser: the one function Way A's tool and Way B's MCP server both
 * call. A URL outside the allowlist is refused before the browser is asked.
 */
export async function readPage(handle: BrowserHandle, allowedOrigins: readonly string[], url: string, signal: AbortSignal): Promise<PageContent> {
  if (!isAllowedUrl(url, allowedOrigins)) throw new OriginRefusedError(url);
  return handle.use(signal, async (context) => {
    const page = await context.newPage();
    await page.goto(url, { timeout: NAVIGATION_TIMEOUT_MS, waitUntil: "domcontentloaded" });
    return {
      title: await page.title(),
      text: (await page.locator("body").innerText({ timeout: NAVIGATION_TIMEOUT_MS })).slice(0, MAX_TEXT_CHARS),
    };
  });
}
