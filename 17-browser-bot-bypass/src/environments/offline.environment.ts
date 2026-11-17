import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

// nothing here calls a model unless the demo scripts one: the provider only needs a key to be built
process.env.OPENROUTER_API_KEY ??= "offline-no-model-is-called";

/** `npm run demo`: the fake browser (`BROWSER_FACTORY=fake`) on the fake web, OpenRouter's wire scripted. */
// the MCP server's child process reads BROWSER_ALLOWED_ORIGINS from the process environment and must have it
process.env.BROWSER_ALLOWED_ORIGINS ??= "https://docs.example.com";

export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  browserAllowedOrigins: env("BROWSER_ALLOWED_ORIGINS"),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
  openRouterBaseUrl: env.optional("OPENROUTER_BASE_URL"),
};
