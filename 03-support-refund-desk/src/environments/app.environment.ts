import type { Secret } from "@agboss/core";

export class AppEnvironment {
  openRouterApiKey!: Secret;
  sqlitePath!: string;
  piiPseudonymKey?: Secret;
}
