import { secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

// the offline tests run LocalScalingApplication (src/local/); this application runs in the cluster
export const environment: AppEnvironment = {
  postgresUrl: secret("POSTGRES_URL"),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  idempotencyKey: secret("IDEMPOTENCY_KEY"),
  ledgerUrl: "http://127.0.0.1:0",
  podName: "test",
  httpPort: 0,
  metricsPort: 0,
};
