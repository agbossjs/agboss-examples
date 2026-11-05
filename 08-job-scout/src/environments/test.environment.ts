import { secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/** What `testWith(JobScoutApplication)` runs on: a host no test reaches (fetches are stubbed or recorded). */
export const environment: AppEnvironment = {
  // unset in tests: testWith gives it a fixed test key (agbossjs/agboss#778)
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  greenhouseApiUrl: "https://greenhouse.test",
  sqlitePath: ":memory:",
};
