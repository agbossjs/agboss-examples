import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

// a pod on your machine against a local PostgreSQL (`npm start`): POSTGRES_URL, the stub's LEDGER_URL
export const environment: AppEnvironment = {
  postgresUrl: secret("POSTGRES_URL"),
  postgresPoolSize: env.integer("POSTGRES_POOL_SIZE", { default: 5 }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  ledgerUrl: env("LEDGER_URL", { default: "http://127.0.0.1:8081" }),
  podName: env("POD_NAME", { default: "local" }),
  httpPort: env.integer("HTTP_PORT", { default: 8080 }),
  metricsPort: env.integer("METRICS_PORT", { default: 9464 }),
};
