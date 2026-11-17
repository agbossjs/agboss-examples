import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

// a synthetic key, the same on every instance — never a real one (R6)
process.env.IDEMPOTENCY_KEY ??= "browser-playwright-test-idempotency-key";

/** `testWith`: the site each test file starts (its variables are set before the app is made). */
export const environment: AppEnvironment = {
  sqlitePath: ":memory:",
  // unset in tests: testWith gives it a fixed test key (agbossjs/agboss#778)
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  idempotencyKey: secret("IDEMPOTENCY_KEY"),
  browserAllowedOrigins: env("BROWSER_ALLOWED_ORIGINS"),
  contactFormUrl: env("CONTACT_FORM_URL"),
  contactLookupUrl: env("CONTACT_LOOKUP_URL"),
};
