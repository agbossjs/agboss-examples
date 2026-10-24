import { env, secret } from "agboss";
import type { AppEnvironment } from "./app.environment.js";

// Provide deterministic offline default so `agboss check`, `demo`, and `eval run` work with zero setup
process.env.PII_PSEUDONYM_KEY ??= "agboss-test-pseudonym-key";

export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
};
