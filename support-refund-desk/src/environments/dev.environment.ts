import { env, secret } from "agboss";
import type { AppEnvironment } from "./app.environment.js";

// Provide deterministic offline default so `agboss check`, `demo`, and `eval run` work with zero setup
process.env.OPENROUTER_API_KEY ??=
  process.env.OPEN_ROUTER_KEY ?? "offline-test-openrouter-api-key";
process.env.PII_PSEUDONYM_KEY ??= "agboss-test-pseudonym-key";

export const environment: AppEnvironment = {
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
};
