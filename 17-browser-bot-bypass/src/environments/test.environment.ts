import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/** `testWith`: the fake browser on the fake web; the allowlist lists the one fake site. */
// the MCP server's child process reads BROWSER_ALLOWED_ORIGINS from the process environment and must have it
process.env.BROWSER_ALLOWED_ORIGINS ??= "https://docs.example.com";

export const environment: AppEnvironment = {
  sqlitePath: ":memory:",
  // unset in tests: testWith gives it a fixed test key (agbossjs/agboss#778)
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  browserAllowedOrigins: env("BROWSER_ALLOWED_ORIGINS"),
};
