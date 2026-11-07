import type { Secret } from "@agboss/core";

/** What a pod reads: its database, the other system, its name and its ports. */
export class AppEnvironment {
  /** The shared PostgreSQL database of every store (`@agboss/postgres`). */
  postgresUrl!: Secret;
  /** Connections of this pod's pool: pods × this ≤ the database's `max_connections`. */
  postgresPoolSize?: number;
  /** The PII key every pod shares (`pseudonymKey`): fingerprints and key handles agree across pods. */
  piiPseudonymKey!: Secret;
  /** The idempotency key (agbossjs/agboss#825): business-key fingerprints only — never the PII key. */
  idempotencyKey!: Secret;
  /** The other system the jobs call: their remote work and the ledger. */
  ledgerUrl!: string;
  /** The pod's name (the downward API), on every receipt and work call. */
  podName!: string;
  /** The pod's own HTTP port: `/health/live`, `/health/ready`, the batch and verification API. */
  httpPort!: number;
  /** The Prometheus exporter's port: `GET /metrics`. */
  metricsPort!: number;
}
