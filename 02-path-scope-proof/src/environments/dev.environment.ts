import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
};
