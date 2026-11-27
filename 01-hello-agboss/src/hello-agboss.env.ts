import { defineEnv, env, secret } from "@agboss/core";

/**
 * The process variables the hello applications read: references, never values. The values of a
 * profile are in `src/config/<profile>.config.ts`; a key it leaves out is read from the process.
 * The model providers' keys and the database storage's secrets are not here: each reads its own
 * reference (`secret(…)`, `env(…)`) when the application starts.
 */
export const helloEnv = defineEnv({
  catalogCurrency: env("CATALOG_CURRENCY", { default: "USD" }),
  /** The company LLM gateway the `GatewayStreamModelProvider` calls (its `/stream`); demo and tests only. */
  gatewayBaseUrl: env.optional("LLM_GATEWAY_BASE_URL"),
  /** The pricing API's bearer token (the offline stub only checks that one is sent). */
  pricingApiKey: secret("PRICING_API_KEY"),
  pricingApiBaseUrl: env("PRICING_API_BASE_URL", {
    default: "https://pricing.internal.example",
  }),
});
