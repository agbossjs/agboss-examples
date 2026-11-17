import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

// a synthetic key, the same on every instance — never a real one (R6)
// nothing here calls a model unless a test says so: the provider only needs a key to be built
process.env.OPENROUTER_API_KEY ??= "offline-no-model-is-called";
process.env.IDEMPOTENCY_KEY ??= "browser-playwright-offline-idempotency-key";

/**
 * `npm run demo` and the crash tests: the local test site (its origin, address and host rule are set
 * by the demo or the test), OpenRouter's wire scripted. A fresh SQLite file per application — two
 * instances of one test share it — or `SQLITE_PATH`.
 */
export const environment: AppEnvironment = {
  get sqlitePath(): string {
    const shared = process.env.SQLITE_PATH;
    if (shared !== undefined && shared !== "") return shared;
    return join(mkdtempSync(join(tmpdir(), "browser-playwright-")), "stores.sqlite");
  },
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  idempotencyKey: secret("IDEMPOTENCY_KEY"),
  browserAllowedOrigins: env("BROWSER_ALLOWED_ORIGINS"),
  contactFormUrl: env("CONTACT_FORM_URL"),
  contactLookupUrl: env("CONTACT_LOOKUP_URL"),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
  openRouterBaseUrl: env.optional("OPENROUTER_BASE_URL"),
};
