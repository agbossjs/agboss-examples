import type { Secret } from "@agboss/core";

process.env.PII_PSEUDONYM_KEY ??= "hello-agboss-offline-pseudonym-key";
process.env.OPENROUTER_API_KEY ??=
  process.env.OPEN_ROUTER_KEY ?? "offline-test-openrouter-api-key";

export class AppEnvironment {
  catalogCurrency!: string;
  openRouterApiKey!: Secret;
  /**
   * OpenRouter's base URL (`baseUrlField`); unset → the provider's default. The offline demo points
   * it at its scripted stand-in on 127.0.0.1 (agbossjs/agboss#834).
   */
  openRouterBaseUrl?: string;
  /**
   * The PII key (agbossjs/agboss#825): a Secret of its own — never the model provider's, which the
   * provider rotates. `test` leaves it out: `testWith` makes tokens with a fixed key.
   */
  piiPseudonymKey?: Secret;
  pricingApiBaseUrl!: string;
  sqlitePath!: string;
}
