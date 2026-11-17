import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/**
 * `npm run demo:live` and your own runs: OpenRouter with your key, real Chrome limited to the origins
 * you list — `example.org` until you do.
 */
// the MCP server's child process reads BROWSER_ALLOWED_ORIGINS from the process environment and must have it
process.env.BROWSER_ALLOWED_ORIGINS ??= "https://example.org";

export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  browserAllowedOrigins: env("BROWSER_ALLOWED_ORIGINS"),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
  openRouterBaseUrl: env.optional("OPENROUTER_BASE_URL"),
};
