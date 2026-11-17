import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { kilobytes, seconds } from "@agboss/core/units";
import { StealthBrowser } from "../browser/stealth-browser.service.js";
import { readPage } from "../browser/read-page.js";
import { PageRequestDto, PageTextDto } from "../dto/page.dto.js";

/**
 * Way A: reads a page in the application's one shared stealth browser, injected through `deps` — the
 * tool never launches or closes it. A URL outside the allowlist is refused before the browser is
 * asked; the context's route and the browser's resolver rules refuse the rest.
 */
@Tool({
  name: "open-page-stealth-tool",
  description: "Open a web page in a real browser and read its title and visible text. Only the allowed sites can be opened.",
  input: PageRequestDto,
  output: PageTextDto,
  timeout: seconds(30),
  maxResultSize: kilobytes(16),
  readOnly: true,
  deps: [ExecutionContext, StealthBrowser],
})
export class OpenPageStealth implements ToolHandler<PageRequestDto, PageTextDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly stealthBrowser: StealthBrowser,
  ) {}

  run({ url }: PageRequestDto): Promise<PageTextDto> {
    return readPage(this.stealthBrowser.handle, this.stealthBrowser.allowedOrigins, url, this.executionContext.signal);
  }
}
