import { defineEnv, env } from "@agboss/core";

/** What the browser may request until you list your own origins: nothing but `example.org`. */
export const DEFAULT_ALLOWED_ORIGINS = "https://example.org";

/**
 * Where the browser may go — public addresses, no secrets.
 * The origins are semicolon-separated (`https://docs.example.com;https://example.org`). Everything else is
 * refused, redirects included — by the tool's browser and by the MCP server's, which reads the same variable.
 * The browser has its own network, outside agboss's A2A SSRF guard.
 */
export const browserEnv = defineEnv({
  allowedOrigins: env("BROWSER_ALLOWED_ORIGINS", { default: DEFAULT_ALLOWED_ORIGINS }),
});
