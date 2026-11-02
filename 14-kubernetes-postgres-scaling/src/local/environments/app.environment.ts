import type { Secret } from "@agboss/core";

/** The local application's settings: the SQLite file in place of the database, the rest as a pod's. */
export class LocalEnvironment {
  /** The stores' SQLite file (`:memory:` in tests). */
  sqlitePath!: string;
  /** The PII key both local instances share. */
  piiPseudonymKey!: Secret;
  /** The other system the jobs call (the stub, in-process). */
  ledgerUrl!: string;
  /** The "pod" name on every receipt. */
  podName!: string;
  httpPort!: number;
  metricsPort!: number;
}
