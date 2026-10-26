import type { Secret } from "@agboss/core";

process.env.PII_PSEUDONYM_KEY ??= "offline-path-scope-pseudonym-key";

export class AppEnvironment {
  piiPseudonymKey!: Secret;
  sqlitePath!: string;
}
