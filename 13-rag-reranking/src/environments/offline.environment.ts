import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

/** `npm run demo`: the Cohere SDK against the local stub the demo starts, OpenRouter's wire scripted. */
export const environment: AppEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  cohereBaseUrl: env("COHERE_BASE_URL", { default: "http://127.0.0.1:4790" }),
  // the demo's offline OpenRouter takes any key
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
  openRouterBaseUrl: env.optional("OPENROUTER_BASE_URL"),
};
