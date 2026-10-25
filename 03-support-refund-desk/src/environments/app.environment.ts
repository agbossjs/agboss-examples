import type { Secret } from "agboss";

export class AppEnvironment {
  openRouterApiKey!: Secret;
  sqlitePath!: string;
  piiPseudonymKey?: Secret;
}
