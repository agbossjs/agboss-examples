import type { Secret } from "agboss";

export class AppEnvironment {
  sqlitePath!: string;
  piiPseudonymKey?: Secret;
}
