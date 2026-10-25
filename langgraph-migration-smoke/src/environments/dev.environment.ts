import { env, secret } from "agboss";
import type { AppEnvironment } from "./app.environment.js";

process.env.PII_PSEUDONYM_KEY ??= "agboss-migration-pseudonym-key";

export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
};
