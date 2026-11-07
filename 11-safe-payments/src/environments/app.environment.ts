import type { Secret } from "@agboss/core";

/** What the application reads: its SQLite file, the stub gateway's address and webhook secret. */
export class AppEnvironment {
  sqlitePath!: string;
  /** The stub gateway's base URL (`http://127.0.0.1:<port>`), set by whoever starts it. */
  stubGatewayUrl!: string;
  /** The secret the stub signs its webhooks with (`Stub-Signature`). */
  stubWebhookSecret!: Secret;
  /** One pseudonym key on every instance (A8): business-key fingerprints agree across instances. */
  piiPseudonymKey!: Secret;
  /** The idempotency key (agbossjs/agboss#825): business-key fingerprints only — never the PII key. */
  idempotencyKey!: Secret;
  /** Read by the (never called) model provider: left unset, the agents' turns are scripted. */
  openRouterApiKey?: Secret;
  openRouterBaseUrl?: string;
}
