import type { Secret } from "@agboss/core";

process.env.PII_PSEUDONYM_KEY ??= "hello-agboss-offline-pseudonym-key";
process.env.OPENROUTER_API_KEY ??=
  process.env.OPEN_ROUTER_KEY ?? "offline-test-openrouter-api-key";

export class AppEnvironment {
  catalogCurrency!: string;
  openRouterApiKey!: Secret;
  /**
   * The PII key (agbossjs/agboss#825): a Secret of its own — never the model provider's, which the
   * provider rotates. `test` leaves it out: `testWith` makes tokens with a fixed key.
   */
  piiPseudonymKey?: Secret;
  pricingApiBaseUrl!: string;
  sqlitePath!: string;
}
