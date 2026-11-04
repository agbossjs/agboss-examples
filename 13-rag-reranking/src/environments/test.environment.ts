import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/** `testWith`: the Cohere SDK against the stub each test file starts (`COHERE_BASE_URL`). */
export const environment: AppEnvironment = {
  sqlitePath: ":memory:",
  // vitest.config.ts sets PII_PSEUDONYM_KEY to a fixed synthetic key (R6)
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  cohereBaseUrl: env("COHERE_BASE_URL", { default: "http://127.0.0.1:4791" }),
};
