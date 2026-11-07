import type { Secret } from "@agboss/core";

process.env.PII_PSEUDONYM_KEY ??= "cluster-work-stealing-pseudonym-key-32b!!";
process.env.IDEMPOTENCY_KEY ??= "cluster-work-stealing-offline-idempotency-key";

export class AppEnvironment {
  sqlitePath!: string;
  piiPseudonymKey?: Secret;
  /** The idempotency key (agbossjs/agboss#825): business-key fingerprints only — never the PII key. */
  idempotencyKey?: Secret;
}
