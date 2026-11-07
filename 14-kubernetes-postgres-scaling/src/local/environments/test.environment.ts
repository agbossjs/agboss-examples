import { env, secret } from "@agboss/core";
import type { LocalEnvironment } from "./app.environment.js";

// the tests start the stub on a free port and set LEDGER_URL before the app is built
export const environment: LocalEnvironment = {
  sqlitePath: ":memory:",
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  idempotencyKey: secret("IDEMPOTENCY_KEY"),
  ledgerUrl: env("LEDGER_URL", { default: "http://127.0.0.1:9" }),
  podName: env("POD_NAME", { default: "test-pod" }),
  httpPort: 0,
  metricsPort: 0,
};
