/**
 * agbossjs/agboss#486 AC1 — the recipe works: the core's metrics, through the official Prometheus
 * exporter, scraped over HTTP in the Prometheus text format with the documented names, kinds and
 * labels (Wiki → Metrics) — and no tenant, execution or thread id anywhere in a label.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect } from "vitest";
import { testWith } from "@agboss/core/testing";
import { KubernetesScalingApplication } from "../../src/kubernetes-scaling.application.js";
import { metricsHandlerOf, prometheusTelemetry } from "../../src/telemetry.js";
import { BatchWorkflowStart } from "../../src/workflows/batch/batch.workflow-start.js";

const { meterProvider, exporter } = prometheusTelemetry(0);
const test = testWith(KubernetesScalingApplication, {
  meterProviders: [meterProvider],
  allowNetwork: ["127.0.0.1"], // the scrape, our own server
});
let server: Server;
let url = "";

beforeAll(async () => {
  server = createServer(metricsHandlerOf(exporter));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/metrics`;
});
afterAll(async () => {
  server.close();
  await meterProvider.shutdown();
});

/** The documented metrics, by Prometheus name and `# TYPE`. */
const DOCUMENTED: Readonly<Record<string, "gauge" | "counter">> = {
  agboss_cluster_children_queued: "gauge",
  agboss_cluster_children_running: "gauge",
  agboss_cluster_children_oldest_queued_seconds: "gauge",
  agboss_instance_step_slots_limit: "gauge",
  agboss_instance_step_slots_busy: "gauge",
  agboss_instance_step_slots_free: "gauge",
  agboss_instance_steps_waiting: "gauge",
  agboss_instance_leases_held: "gauge",
  agboss_instance_executions_ended_total: "counter",
};

test("AC1: scraping the exporter returns the documented metrics in Prometheus format", async ({ app }) => {
  const jobs = Array.from({ length: 6 }, (_, index) => ({ jobId: `j-${String(index)}`, durationMs: 0 }));
  const result = await app.execute(BatchWorkflowStart, jobs, { tenant: { tenantId: "acme" } });

  const response = await fetch(url);
  const text = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/plain");
  for (const [name, type] of Object.entries(DOCUMENTED))
    expect(text, name).toContain(`# TYPE ${name} ${type}`);
  expect(text).toMatch(/^agboss_cluster_children_queued\{[^}]*\} 0$/mu);
  expect(text).toMatch(/^agboss_instance_step_slots_limit\{[^}]*\} 4$/mu);
  expect(text).toMatch(/^agboss_instance_leases_held\{[^}]*\} 0$/mu);
  expect(text).toMatch(
    /^agboss_instance_executions_ended_total\{workflow="job-workflow",outcome="finished",[^}]*\} 6$/mu,
  );
  // bounded labels: no tenant, execution or thread id is a label value
  for (const id of ["acme", result.executionId, result.threadId]) expect(text).not.toContain(`"${id}"`);
});
