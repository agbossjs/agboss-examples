import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/**
 * `npm run demo:live` (the demo points the three site variables at its local site) and your own runs:
 * OpenRouter with your key, the browser limited to the origins you list — `example.org` until you do.
 */
// the MCP server's child process reads BROWSER_ALLOWED_ORIGINS from the process environment and must have it:
// a first run without your own list gets example.org
process.env.BROWSER_ALLOWED_ORIGINS ??= "https://example.org";
process.env.CONTACT_FORM_URL ??= "https://example.org/contact";
process.env.CONTACT_LOOKUP_URL ??= "https://example.org";

export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  idempotencyKey: secret("IDEMPOTENCY_KEY"),
  browserAllowedOrigins: env("BROWSER_ALLOWED_ORIGINS"),
  contactFormUrl: env("CONTACT_FORM_URL"),
  contactLookupUrl: env("CONTACT_LOOKUP_URL"),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
  openRouterBaseUrl: env.optional("OPENROUTER_BASE_URL"),
};
