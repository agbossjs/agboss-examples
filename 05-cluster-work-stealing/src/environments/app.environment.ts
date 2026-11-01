import type { Secret } from "@agboss/core";

process.env.PII_PSEUDONYM_KEY ??= "cluster-work-stealing-pseudonym-key-32b!!";

export class AppEnvironment {
  sqlitePath!: string;
  piiPseudonymKey?: Secret;
}
