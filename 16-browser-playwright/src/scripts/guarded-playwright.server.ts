/**
 * The official @playwright/mcp server, started by its own documented API (`createConnection`) with
 * the browser context handed to it — a context guarded by the same origin allowlist as Way A's. The
 * server's own `--allowed-origins` is "not a security boundary" and "does not affect redirects" (its
 * README), so the allowlist is enforced here, at the context's route, on every hop.
 *
 * Runs as the stdio child `@McpServer` starts (`node --import tsx guarded-playwright.server.ts`);
 * reads `BROWSER_ALLOWED_ORIGINS` from its environment, the variable Way A reads too. Closes its browser when the client disconnects.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createConnection } from "@playwright/mcp";
import { BrowserHandle } from "../browser/browser-handle.js";
import { parseAllowlist } from "../browser/origin-allowlist.js";

const { origins, hostMap } = parseAllowlist(process.env.BROWSER_ALLOWED_ORIGINS);
const handle = new BrowserHandle({ allowedOrigins: origins, hostRules: hostMap });

const server = await createConnection({ capabilities: ["core", "core-navigation"] }, () => handle.openContext());
const transport = new StdioServerTransport();
transport.onclose = () => {
  void handle.close().then(() => process.exit(0));
};
await server.connect(transport);
