import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { kilobytes, seconds } from "@agboss/core/units";
import { OriginRefusedError, isAllowedUrl } from "../browser/origin-allowlist.js";
import { SharedBrowser } from "../browser/shared-browser.service.js";
import { PageRequestDto, PageTextDto } from "../dto/page.dto.js";

/** The longest a page may take to load: the page's own timeout, under the tool's. */
const NAVIGATION_TIMEOUT_MS = 10_000;
/** How much of the page's text the model reads. */
const MAX_TEXT_CHARS = 8_000;

/**
 * Way A: reads a page. The browser is the application's one shared Chromium, injected through
 * `deps` — the tool never launches or closes it. A URL outside the allowlist is refused before the
 * browser is asked; the context's route refuses anything the page itself then requests (a redirect,
 * an image, a script) the same way.
 */
@Tool({
  name: "open-page-tool",
  description: "Open a web page and read its title and visible text. Only the allowed sites can be opened.",
  input: PageRequestDto,
  output: PageTextDto,
  timeout: seconds(20),
  maxResultSize: kilobytes(16),
  readOnly: true,
  deps: [ExecutionContext, SharedBrowser],
})
export class OpenPage implements ToolHandler<PageRequestDto, PageTextDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly sharedBrowser: SharedBrowser,
  ) {}

  run({ url }: PageRequestDto): Promise<PageTextDto> {
    if (!isAllowedUrl(url, this.sharedBrowser.allowedOrigins)) return Promise.reject(new OriginRefusedError(url));
    // the call's signal: the tool's timeout and a cancelled run both close the session's context
    return this.sharedBrowser.handle.use(this.executionContext.signal, async (context) => {
      const page = await context.newPage();
      const response = await page.goto(url, { timeout: NAVIGATION_TIMEOUT_MS, waitUntil: "domcontentloaded" });
      if (response !== null && !response.ok()) throw new Error(`the site answered ${String(response.status())}`);
      return {
        title: await page.title(),
        text: (await page.locator("body").innerText({ timeout: NAVIGATION_TIMEOUT_MS })).slice(0, MAX_TEXT_CHARS),
      };
    });
  }
}
