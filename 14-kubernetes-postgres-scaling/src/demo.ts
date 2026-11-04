// `npm run demo` — offline, no model, no cluster: two instances of the same workflows on one SQLite
// file (LocalScalingApplication), the ledger stub in-process, a batch of twelve jobs — one of them
// rejected by the other system: it ends at its own failure finish and the others go on. Prometheus is
// scraped while the backlog waits and after it; then the run is verified from state — the kept
// records, the lease log, the outbound calls and the stub's ledger — as the cluster's scenario does.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "@agboss/core";
import { LocalScalingApplication } from "./local/local-scaling.application.js";
import { startLedgerStub } from "./stub/ledger-stub.js";
import { metricsHandlerOf, prometheusTelemetry } from "./telemetry.js";
import { batchEvidenceOf } from "./verification/evidence.js";
import { verifyRun } from "./verification/verify.js";
import { BatchWorkflowStart } from "./workflows/batch/batch.workflow-start.js";

// offline, synthetic (R6): the two local instances share this PII key
process.env.PII_PSEUDONYM_KEY ??= "local-demo-synthetic-pseudonym-key";
const stub = await startLedgerStub(0, "127.0.0.1");
process.env.LEDGER_URL = stub.url;
process.env.SQLITE_PATH ??= join(mkdtempSync(join(tmpdir(), "agboss-scaling-")), "demo.sqlite");

const { meterProvider, exporter } = prometheusTelemetry(0);
const metrics = createServer(metricsHandlerOf(exporter));
await new Promise<void>((resolve) => metrics.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${String((metrics.address() as AddressInfo).port)}/metrics`;
process.env.POD_NAME = "pod-a";
const a = await createApp(LocalScalingApplication, { meterProvider });
process.env.POD_NAME = "pod-b";
const b = await createApp(LocalScalingApplication);

const DEMAND = [
  "agboss_cluster_children_queued",
  "agboss_instance_step_slots_busy",
  "agboss_instance_steps_waiting",
  "agboss_instance_leases_held",
];
async function scrape(when: string): Promise<void> {
  const text = await (await fetch(url)).text();
  const lines = text.split("\n").filter((line) => DEMAND.some((name) => line.startsWith(name)));
  console.log(`--- GET /metrics of pod-a (${when})\n${lines.join("\n")}`);
}

const jobs = Array.from({ length: 12 }, (_, index) => ({ jobId: `demo-${String(index)}`, durationMs: 400 }));
// the other system refuses one job: it fails alone, the batch finishes with the other eleven
const rejected = "demo-7";
await fetch(`${stub.url}/control/rejects`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jobId: rejected }),
});
const batch = a.execute(BatchWorkflowStart, jobs, { threadId: "demo" });
await new Promise((resolve) => setTimeout(resolve, 150));
await scrape("12 jobs, 4 slots per pod: the backlog");
const result = await batch;
await scrape("after the batch: idle");
console.log(`batch done (${rejected} rejected by the other system):`, JSON.stringify(result.output));

const report = verifyRun({
  batches: [await batchEvidenceOf(a, "demo", jobs.map((job) => job.jobId), [rejected])],
  stub: stub.state(),
  expectations: [],
});
const pods = new Set(report.jobs.flatMap((job) => job.attempts.map((attempt) => attempt.instanceId)));
console.log(
  `verified from state: ${String(report.totals.jobs)} jobs (${String(report.totals.failed)} failed), ${String(report.totals.accepted)} deliveries, ` +
    `${String(stub.state().entries.length)} ledger entries, ${String(report.totals.duplicates)} duplicates, ` +
    `on ${String(pods.size)} instances — ${report.passed ? "PASSED" : "FAILED"}`,
);
await Promise.all([a.close(), b.close()]);
await meterProvider.shutdown();
metrics.close();
await stub.close();
if (!report.passed) process.exitCode = 1;
