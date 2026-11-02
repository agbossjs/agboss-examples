import type { Secret } from "@agboss/core";

/** What a worker reads: its shared store, its ports, its maximum stop. */
export class AppEnvironment {
  /** The stores' SQLite file — one per machine here; #487 moves the stores to PostgreSQL. */
  sqlitePath!: string;
  /** The worker's own HTTP port: `/health/live`, `/health/ready`, `POST /api/batches`. */
  httpPort!: number;
  /** The Prometheus exporter's port: `GET /metrics`. */
  metricsPort!: number;
  /** The built-in model provider's key: no component here calls a model, so it stays a placeholder. */
  openRouterApiKey!: Secret;
}
