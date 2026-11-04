// A pod (agbossjs/agboss#487): the application on PostgreSQL with its meter provider, its endpoints
// and its graceful stop. `createApp` closes the app on SIGTERM (Kubernetes' stop) within
// `shutdownTimeout`; the pod's `terminationGracePeriodSeconds` leaves room for it
// (deploy/worker-deployment.yaml). The coordinator and the workers run this same file.
import { createApp } from "@agboss/core";
import { serve } from "./http/server.js";
import { KubernetesScalingApplication } from "./kubernetes-scaling.application.js";
import { prometheusTelemetry } from "./telemetry.js";

const metricsPort = Number(process.env.METRICS_PORT ?? 9464);
const { meterProvider } = prometheusTelemetry(metricsPort);
const app = await createApp(KubernetesScalingApplication, {
  env: process.env.AGBOSS_ENV ?? "dev",
  meterProvider,
});
const { server } = await serve(app, Number(process.env.HTTP_PORT ?? 8080), {
  ledgerUrl: process.env.LEDGER_URL ?? "http://127.0.0.1:8081",
  onBatchError: (batchId, error) => {
    console.error(`batch ${batchId} did not finish here:`, error instanceof Error ? error.message : error);
  },
});

process.once("SIGTERM", () => {
  server.close();
  // the app's own SIGTERM listener drains it; the exporter goes last
  void app.close().then(() => meterProvider.shutdown());
});
