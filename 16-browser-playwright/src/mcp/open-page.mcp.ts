import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { OriginRefusedError, isAllowedUrl } from "../browser/origin-allowlist.js";
import { SharedBrowser } from "../browser/shared-browser.service.js";
import { PageRequestDto, PageTextDto } from "../dto/page.dto.js";
import { PlaywrightServer } from "./playwright.server.js";
import { PLAYWRIGHT_SESSION } from "./serial.js";

/** Way B: reads a page through @playwright/mcp — the same allowlist, checked here and in the server's browser. */
@Tool({
  name: "open-page-mcp-tool",
  description: "Open a web page and read its title and what is on it. Only the allowed sites can be opened.",
  input: PageRequestDto,
  output: PageTextDto,
  timeout: seconds(30),
  readOnly: true,
  deps: [ExecutionContext, PlaywrightServer, SharedBrowser],
})
export class OpenPageViaMcp implements ToolHandler<PageRequestDto, PageTextDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly server: PlaywrightServer,
    private readonly sharedBrowser: SharedBrowser,
  ) {}

  async execute({ url }: PageRequestDto): Promise<PageTextDto> {
    if (!isAllowedUrl(url, this.sharedBrowser.allowedOrigins)) throw new OriginRefusedError(url);
    const { signal } = this.executionContext;
    // the server's one page: this call's navigate and snapshot are not interleaved with another's
    return PLAYWRIGHT_SESSION.run(async () => {
      await this.server.call("browser_navigate", { url }, { signal });
      const { text } = await this.server.call("browser_snapshot", {}, { signal });
      return { title: /- Page Title: (.*)/u.exec(text)?.[1] ?? "", text: text.slice(0, 8_000) };
    });
  }
}
