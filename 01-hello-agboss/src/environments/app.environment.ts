import type { Secret } from "@agboss/core";

process.env.PII_PSEUDONYM_KEY ??= "hello-agboss-offline-pseudonym-key";
process.env.OPENROUTER_API_KEY ??= process.env.OPEN_ROUTER_KEY ?? "offline-test-openrouter-api-key";
process.env.PRICING_API_KEY ??= "offline-test-pricing-api-key";

/**
 * The environment contract: declared fields only. The model providers' keys and base URLs and the
 * database storage's secrets are not here: each reads its own reference (`secret(…)`, `env(…)`,
 * `defineEnv`) when the application starts.
 */
export class AppEnvironment {
  catalogCurrency!: string;
  /** The company LLM gateway the `GatewayStreamModelProvider` calls (its `/stream`); demo and tests only. */
  gatewayBaseUrl?: string;
  /** The pricing API's bearer token (the offline stub only checks that one is sent). */
  pricingApiKey!: Secret;
  pricingApiBaseUrl!: string;
}
