import { secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  sqlitePath: ":memory:",
};
