import { defineEnv, env } from "@agboss/core";

/**
 * What a pod reads besides its storage (the database URL, the keys: `KubernetesDatabaseStorage` /
 * `LocalDatabaseStorage` read their own references): the other system, its name and its ports.
 * References, never values: the defaults are a pod on your machine against the stub (`npm start`); a pod
 * in the cluster sets every one in its manifest (`deploy/kind/`). `src/local/config/test.config.ts` sets
 * the values of the local application's tests; a key a profile leaves out is read from the process.
 */
export const scalingEnv = defineEnv({
  /** The other system the jobs call: their remote work and the ledger. */
  ledgerUrl: env("LEDGER_URL", { default: "http://127.0.0.1:8081" }),
  /** The pod's name (the downward API), on every receipt and work call. */
  podName: env("POD_NAME", { default: "local" }),
  /** The pod's own HTTP port: `/health/live`, `/health/ready`, the batch and verification API. */
  httpPort: env.integer("HTTP_PORT", { default: 8080 }),
  /** The Prometheus exporter's port: `GET /metrics`. */
  metricsPort: env.integer("METRICS_PORT", { default: 9464 }),
});
