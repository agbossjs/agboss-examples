import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  catalogCurrency: env("CATALOG_CURRENCY", { default: "USD" }),
  gatewayBaseUrl: env.optional("LLM_GATEWAY_BASE_URL"),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
  openRouterBaseUrl: env.optional("OPENROUTER_BASE_URL"),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  pricingApiBaseUrl: env("PRICING_API_BASE_URL", {
    default: "https://pricing.internal.example",
  }),
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
};
