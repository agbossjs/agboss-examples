import type { Secret } from "agboss";

process.env.OPENROUTER_API_KEY ??=
  process.env.OPEN_ROUTER_KEY ?? "offline-test-openrouter-api-key";

export class AppEnvironment {
  catalogCurrency!: string;
  openRouterApiKey!: Secret;
  pricingApiBaseUrl!: string;
  sqlitePath!: string;
}
