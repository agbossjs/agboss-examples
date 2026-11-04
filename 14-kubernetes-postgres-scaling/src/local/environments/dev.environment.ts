import { env, secret } from "@agboss/core";
import type { LocalEnvironment } from "./app.environment.js";

export const environment: LocalEnvironment = {
  sqlitePath: env("SQLITE_PATH", { default: ".agboss/scaling.sqlite" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  ledgerUrl: env("LEDGER_URL", { default: "http://127.0.0.1:8081" }),
  podName: env("POD_NAME", { default: "local" }),
  httpPort: env.integer("HTTP_PORT", { default: 8080 }),
  metricsPort: env.integer("METRICS_PORT", { default: 9464 }),
};
