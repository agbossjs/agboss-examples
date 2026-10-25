import { secret } from "agboss";
import type { AppEnvironment } from "./app.environment.js";

export const environment: AppEnvironment = {
  catalogCurrency: "USD",
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
  pricingApiBaseUrl:
    process.env.PRICING_API_BASE_URL ?? "https://pricing.internal.example",
  sqlitePath: ":memory:",
};
