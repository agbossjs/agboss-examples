import { fileURLToPath } from "node:url";
import { McpServer, McpServerClient, McpTransport } from "@agboss/core/mcp";
import { siteEnv } from "../site/site.env.js";
import { EvaluateArgumentsDto, NavigateArgumentsDto, ServerTextDto, SnapshotArgumentsDto } from "./playwright.dto.js";

/**
 * The typed subset of @playwright/mcp's tools this workflow uses — each checked against the server at
 * startup (its name and a compatible input schema), the rest of its ~25 tools never offered to a model
 * (no `browser_run_code_unsafe`, no `browser_file_upload`, no `browser_evaluate` of the model's own).
 */
const tools = {
  browser_navigate: { input: NavigateArgumentsDto, output: ServerTextDto },
  browser_snapshot: { input: SnapshotArgumentsDto, output: ServerTextDto },
  browser_evaluate: { input: EvaluateArgumentsDto, output: ServerTextDto },
};

/** The server process: the official package behind the example's guarded launcher (see its header). */
const LAUNCHER = fileURLToPath(new URL("./guarded-playwright.server.ts", import.meta.url));

@McpServer({
  name: "playwright",
  transport: McpTransport.Stdio,
  command: process.execPath,
  // `--import tsx` runs the TypeScript launcher; resolved from the project directory the app runs in
  args: ["--import", "tsx", LAUNCHER],
  // the child reads the variable Way A reads: the allowed origins (the list of `parseAllowlist`)
  env: { BROWSER_ALLOWED_ORIGINS: siteEnv.allowedOrigins },
  tools,
})
export class PlaywrightServer extends McpServerClient<typeof tools> {}
