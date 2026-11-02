// `npm run demo` — offline, no model: one worker with four step slots gets a batch of twelve jobs
// and Prometheus is scraped while it works and after — the scale-out signal rises, then drains.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "@agboss/core";
import { KubernetesScalingApplication } from "./kubernetes-scaling.application.js";
import { metricsHandlerOf, prometheusTelemetry } from "./telemetry.js";
import { BatchWorkflowStart } from "./workflows/batch/batch.workflow-start.js";

process.env.SQLITE_PATH ??= join(
  mkdtempSync(join(tmpdir(), "agboss-scaling-")),
  "demo.sqlite",
);
const { meterProvider, exporter } = prometheusTelemetry(0);
const metrics = createServer(metricsHandlerOf(exporter));
await new Promise<void>((resolve) => metrics.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${String((metrics.address() as AddressInfo).port)}/metrics`;
const app = await createApp(KubernetesScalingApplication, { meterProvider });

const DEMAND = [
  "agboss_cluster_children_queued",
  "agboss_instance_step_slots_busy",
  "agboss_instance_steps_waiting",
  "agboss_instance_leases_held",
];
async function scrape(when: string): Promise<void> {
  const text = await (await fetch(url)).text();
  const lines = text
    .split("\n")
    .filter((line) => DEMAND.some((name) => line.startsWith(name)));
  console.log(`--- GET /metrics (${when})\n${lines.join("\n")}`);
}

const jobs = Array.from({ length: 12 }, (_, index) => ({
  jobId: `job-${String(index)}`,
  durationMs: 400,
}));
const batch = app.execute(BatchWorkflowStart, jobs);
await new Promise((resolve) => setTimeout(resolve, 150));
await scrape("12 jobs, 4 slots: the backlog");
const result = await batch;
await scrape("after the batch: idle");
console.log("batch done:", JSON.stringify(result.output));
await app.close();
await meterProvider.shutdown();
metrics.close();
