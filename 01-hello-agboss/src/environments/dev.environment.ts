import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  catalogCurrency: env("CATALOG_CURRENCY", { default: "USD" }),
  gatewayBaseUrl: env.optional("LLM_GATEWAY_BASE_URL"),
  pricingApiKey: secret("PRICING_API_KEY"),
  pricingApiBaseUrl: env("PRICING_API_BASE_URL", {
    default: "https://pricing.internal.example",
  }),
};
