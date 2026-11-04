import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

// a pod in the cluster (AGBOSS_ENV=prod, deploy/kind/): every value from the pod's env
export const environment: AppEnvironment = {
  postgresUrl: secret("POSTGRES_URL"),
  postgresPoolSize: env.integer("POSTGRES_POOL_SIZE", { default: 5 }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  ledgerUrl: env("LEDGER_URL"),
  podName: env("POD_NAME"),
  httpPort: env.integer("HTTP_PORT", { default: 8080 }),
  metricsPort: env.integer("METRICS_PORT", { default: 9464 }),
};
