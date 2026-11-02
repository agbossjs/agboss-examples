// The recipe (agbossjs/agboss#486): the core publishes its metrics through the OpenTelemetry
// `MeterProvider` the app is given (#485); the official Prometheus exporter serves them. Nothing
// AGBoss-specific here — any OpenTelemetry reader or exporter works the same way.
import type { IncomingMessage, ServerResponse } from "node:http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider } from "@opentelemetry/sdk-metrics";

/** A worker's meter provider and its Prometheus endpoint (`GET :<port>/metrics`; 0: not started). */
export function prometheusTelemetry(port: number): {
  readonly meterProvider: MeterProvider;
  readonly exporter: PrometheusExporter;
} {
  const exporter = new PrometheusExporter({
    port,
    preventServerStart: port === 0,
  });
  const resource = resourceFromAttributes({ "service.name": "agboss-worker" });
  return {
    meterProvider: new MeterProvider({ resource, readers: [exporter] }),
    exporter,
  };
}
// then: createApp(App, { meterProvider }) — and at the very end: await meterProvider.shutdown()

/** The exporter's `/metrics` on a server of our own (tests, the demo: any free port). */
export const metricsHandlerOf =
  (exporter: PrometheusExporter) =>
  (request: IncomingMessage, response: ServerResponse): void => {
    exporter.getMetricsRequestHandler(request, response);
  };
