import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { HealthStatus, type App, type HealthReport } from "@agboss/core";
import { batchEvidenceOf, stubStateOf, TENANT } from "../verification/evidence.js";
import { verifyRun, type Expectation } from "../verification/verify.js";
import { BatchWorkflowStart } from "../workflows/batch/batch.workflow-start.js";

/**
 * A pod's own endpoints (agbossjs/agboss#487):
 *
 * - `GET /health/live`, `GET /health/ready` — the probes Kubernetes reads; a stopping instance is
 *   `Unhealthy`, so it leaves the Service before it drains;
 * - `POST /api/batches {batchId, jobs}` — starts a batch on thread `batchId` and answers 202 at
 *   once: the tree runs on, held by its lease, and any pod continues it if this one dies;
 * - `GET /api/batches/:batchId` — its kept execution record;
 * - `GET /api/trees/:rootExecutionId` — a running tree's audit log and outbound calls;
 * - `POST /api/verification {batches: [{batchId, jobIds, failedJobIds}], expectations}` — the report
 *   (`verifyRun`); `failedJobIds` are the jobs the other system was told to reject.
 *
 * Every pod serves them; the `coordinator` Service sends to the coordinator pod only.
 */

interface BatchRequest {
  readonly batchId: string;
  readonly jobs: readonly { readonly jobId: string; readonly durationMs: number }[];
}

interface VerificationRequest {
  readonly batches: readonly {
    readonly batchId: string;
    readonly jobIds?: readonly string[];
    /** The jobs the other system was told to reject: each must end at its failure finish. */
    readonly failedJobIds?: readonly string[];
  }[];
  readonly expectations?: readonly Expectation[];
}

async function bodyOf(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim() === "" ? {} : (JSON.parse(text) as unknown);
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const probeStatus = (report: HealthReport): number => (report.status === HealthStatus.Unhealthy ? 503 : 200);

/** What the routes need: the app, the stub's URL, and where a failed background batch is told. */
export interface ServeOptions {
  readonly ledgerUrl: string;
  readonly onBatchError?: (batchId: string, error: unknown) => void;
}

async function handle(app: App, options: ServeOptions, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const path = new URL(request.url ?? "/", "http://pod").pathname;
  const route = `${request.method ?? "GET"} ${path}`;
  if (route === "GET /health/live") {
    const report = await app.checkLiveness();
    send(response, probeStatus(report), report);
  } else if (route === "GET /health/ready") {
    const report = await app.checkReadiness();
    send(response, probeStatus(report), report);
  } else if (route === "POST /api/batches") {
    const { batchId, jobs } = (await bodyOf(request)) as BatchRequest;
    app.execute(BatchWorkflowStart, [...jobs], { threadId: batchId, tenant: { tenantId: TENANT } }).catch((error: unknown) => {
      options.onBatchError?.(batchId, error);
    });
    send(response, 202, { batchId, jobs: jobs.length });
  } else if (request.method === "GET" && path.startsWith("/api/batches/")) {
    const evidence = await batchEvidenceOf(app, decodeURIComponent(path.slice("/api/batches/".length)));
    send(response, evidence.record === undefined ? 404 : 200, evidence.record ?? { error: "not-kept-yet" });
  } else if (request.method === "GET" && path.startsWith("/api/trees/")) {
    const tree = { tenantId: TENANT, rootExecutionId: decodeURIComponent(path.slice("/api/trees/".length)) };
    send(response, 200, { auditLog: await app.auditLogOf(tree), outboundCalls: await app.outboundCallsOf(tree) });
  } else if (route === "POST /api/verification") {
    const { batches, expectations = [] } = (await bodyOf(request)) as VerificationRequest;
    const evidence = await Promise.all(batches.map((batch) => batchEvidenceOf(app, batch.batchId, batch.jobIds, batch.failedJobIds)));
    send(response, 200, verifyRun({ batches: evidence, stub: await stubStateOf(options.ledgerUrl), expectations }));
  } else send(response, 404, { error: "not-found" });
}

/** Serves `app` on `port` (0: any free port); resolves with its base URL once listening. */
export async function serve(app: App, port: number, options: ServeOptions): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    handle(app, options, request, response).catch((error: unknown) => {
      send(response, 400, { error: error instanceof Error ? error.message : String(error) });
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(port, "0.0.0.0", resolve);
  });
  const { port: bound } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${String(bound)}` };
}
