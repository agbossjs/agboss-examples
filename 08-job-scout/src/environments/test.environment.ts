import { secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/** What `testWith(JobScoutApplication)` runs on: a host no test reaches (fetches are stubbed or recorded). */
export const environment: AppEnvironment = {
  // vitest.config.ts sets PII_PSEUDONYM_KEY to a fixed synthetic key (R6)
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  greenhouseApiUrl: "https://greenhouse.test",
  sqlitePath: ":memory:",
};
