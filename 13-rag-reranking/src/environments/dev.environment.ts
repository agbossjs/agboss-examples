import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/** A live run: Cohere's API and OpenRouter, with your own keys. */
export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  cohereApiKey: secret("COHERE_API_KEY"),
  cohereBaseUrl: env.optional("COHERE_BASE_URL"),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
};
