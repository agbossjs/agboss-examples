/**
 * Way B's server: a tiny MCP server of our own around the same shared-browser code, because the
 * plugin ships none. One tool, `open_page`, over stdio — started by `@McpServer` as a child process
 * (`node --import tsx stealth-browser.server-main.ts [--fake]`), reading `BROWSER_ALLOWED_ORIGINS`
 * from its environment, the variable the application reads too.
 * Its browser is closed when the client disconnects.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FakeBrowserFactory } from "../fake/fake-browser.factory.js";
import { browserFactoryClass } from "../browser/browser-choice.js";
import { BrowserHandle } from "../browser/browser-handle.js";
import { OriginRefusedError, parseAllowlist } from "../browser/origin-allowlist.js";
import { readPage } from "../browser/read-page.js";

const { origins: allowedOrigins, hostMap } = parseAllowlist(process.env.BROWSER_ALLOWED_ORIGINS);
// `--fake`: the fake browser of the tests and the offline demo, in place of real Chrome
const factory = process.argv.includes("--fake") ? new FakeBrowserFactory() : new (browserFactoryClass())();
const handle = new BrowserHandle(factory, { allowedOrigins, hostRules: hostMap });

const server = new McpServer({ name: "stealth-browser", version: "1.0.0" });

server.registerTool(
  "open_page",
  {
    description: "Open a web page in a real browser and return its title and visible text. Only allowed origins can be opened.",
    inputSchema: { url: z.string().describe("the page's full URL") },
  },
  async ({ url }, extra) => {
    try {
      const page = await readPage(handle, allowedOrigins, url, extra.signal);
      return { content: [{ type: "text" as const, text: JSON.stringify(page) }], structuredContent: { ...page } };
    } catch (error) {
      const message = error instanceof OriginRefusedError ? error.message : `could not open the page: ${error instanceof Error ? error.message : String(error)}`;
      return { isError: true, content: [{ type: "text" as const, text: message }] };
    }
  },
);

const transport = new StdioServerTransport();
transport.onclose = () => {
  void handle.close().then(() => process.exit(0));
};
await server.connect(transport);
