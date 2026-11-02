// A worker pod: the app with its meter provider, its endpoints, its graceful stop. `createApp`
// closes the app on SIGTERM (Kubernetes' stop) within `shutdownTimeout`; the pod's
// `terminationGracePeriodSeconds` leaves room for it (deploy/worker-deployment.yaml).
import { createApp } from "@agboss/core";
import { serve } from "./http/server.js";
import { KubernetesScalingApplication } from "./kubernetes-scaling.application.js";
import { prometheusTelemetry } from "./telemetry.js";

const metricsPort = Number(process.env.METRICS_PORT ?? 9464);
const { meterProvider } = prometheusTelemetry(metricsPort);
const app = await createApp(KubernetesScalingApplication, { meterProvider });
const { server } = await serve(app, Number(process.env.HTTP_PORT ?? 8080));

process.once("SIGTERM", () => {
  server.close();
  // the app's own SIGTERM listener drains it; the exporter goes last
  void app.close().then(() => meterProvider.shutdown());
});
