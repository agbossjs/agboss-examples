import { ExecutionContext, type ToolHandler } from "@agboss/core";
import { McpTool } from "@agboss/core/mcp";
import { seconds } from "@agboss/core/units";
import { OriginRefusedError, isAllowedUrl } from "../browser/origin-allowlist.js";
import { StealthBrowser } from "../browser/stealth-browser.service.js";
import { PageRequestDto, PageTextDto } from "../dto/page.dto.js";
import { StealthBrowserServer } from "./stealth-browser.server.js";

/** Way B: reads a page through the example's own MCP server — the same allowlist, checked here and in the server's browser. */
@McpTool({
  server: StealthBrowserServer,
  name: "open-page-stealth-mcp-tool",
  description: "Open a web page in a real browser and read its title and visible text. Only the allowed sites can be opened.",
  input: PageRequestDto,
  output: PageTextDto,
  timeout: seconds(40),
  readOnly: true,
  deps: [ExecutionContext, StealthBrowserServer, StealthBrowser],
})
export class OpenPageStealthViaMcp implements ToolHandler<PageRequestDto, PageTextDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly server: StealthBrowserServer,
    private readonly stealthBrowser: StealthBrowser,
  ) {}

  async run({ url }: PageRequestDto): Promise<PageTextDto> {
    if (!isAllowedUrl(url, this.stealthBrowser.allowedOrigins)) throw new OriginRefusedError(url);
    return this.server.call("open_page", { url }, this.executionContext.signal);
  }
}
