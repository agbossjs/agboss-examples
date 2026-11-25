import { fileURLToPath } from "node:url";
import { McpServer, McpServerClient, McpTransport } from "@agboss/core/mcp";
import { browserEnv } from "../browser/browser.env.js";
import { OpenPageArgumentsDto, OpenedPageDto } from "./stealth-browser.dto.js";

/** The server tool this workflow uses — checked against the server at startup. */
const tools = {
  open_page: { input: OpenPageArgumentsDto, output: OpenedPageDto },
};

const SERVER_MAIN = fileURLToPath(new URL("./stealth-browser.server-main.ts", import.meta.url));

/** The example's own MCP server (the plugin ships none), started over stdio. */
@McpServer({
  name: "stealth-browser",
  transport: McpTransport.Stdio,
  command: process.execPath,
  // `--import tsx` runs the TypeScript server; resolved from the project directory the app runs in
  // `--fake` when the tests or the offline demo run on the fake browser: the child follows the application
  args: ["--import", "tsx", SERVER_MAIN, ...(process.env.BROWSER_FACTORY === "fake" ? ["--fake"] : [])],
  // the child reads the variable the application reads: the allowed origins (the list of `parseAllowlist`)
  env: { BROWSER_ALLOWED_ORIGINS: browserEnv.allowedOrigins },
  tools,
})
export class StealthBrowserServer extends McpServerClient<typeof tools> {}
