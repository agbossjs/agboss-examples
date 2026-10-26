import type { Secret } from "@agboss/core";

process.env.PII_PSEUDONYM_KEY ??= "cluster-work-stealing-pseudonym-key-32b!!";
process.env.OPENROUTER_API_KEY ??=
  process.env.OPEN_ROUTER_KEY ?? "offline-test-openrouter-api-key";

export class AppEnvironment {
  sqlitePath!: string;
  piiPseudonymKey?: Secret;
  openRouterApiKey!: Secret;
}
