import type { Secret } from "@agboss/core";

/** What the application reads: its SQLite file and where the gateway (here: its stub) is. */
export class AppEnvironment {
  sqlitePath!: string;
  /** The gateway stub's base URL (`http://127.0.0.1:<port>`; PayPal's: `https://…`), set by whoever starts it. */
  gatewayStubUrl!: string;
  /** PayPal's stub only: the PEM of its test-time certificate (the SDK's TLS agent trusts it). */
  gatewayStubCa?: string;
  /** One pseudonym key on every instance (A8). */
  piiPseudonymKey!: Secret;
  /** The idempotency key (agbossjs/agboss#825): business-key fingerprints only — never the PII key. */
  idempotencyKey!: Secret;
}
