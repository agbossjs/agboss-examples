import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { HealthStatus, type App, type HealthReport } from "@agboss/core";
import type { JobDto } from "../dto/job.dto.js";
import { BatchWorkflowStart } from "../workflows/batch/batch.workflow-start.js";

/**
 * The worker's own endpoints: the probes Kubernetes reads (`/health/live`, `/health/ready` — a
 * stopping instance is `Unhealthy`, so it leaves the Service before it drains) and the batch API
 * the workload generator posts to. The metrics are the exporter's own port.
 */

async function bodyOf(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim() === "" ? [] : (JSON.parse(text) as unknown);
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const probeStatus = (report: HealthReport): number =>
  report.status === HealthStatus.Unhealthy ? 503 : 200;

async function handle(
  app: App,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const path = new URL(request.url ?? "/", "http://worker").pathname;
  if (request.method === "GET" && path === "/health/live") {
    const report = await app.checkLiveness();
    send(response, probeStatus(report), report);
  } else if (request.method === "GET" && path === "/health/ready") {
    const report = await app.checkReadiness();
    send(response, probeStatus(report), report);
  } else if (request.method === "POST" && path === "/api/batches") {
    const jobs = (await bodyOf(request)) as JobDto[];
    const result = await app.execute(BatchWorkflowStart, jobs);
    send(response, 200, {
      executionId: result.executionId,
      output: result.output,
    });
  } else send(response, 404, { error: "not-found" });
}

/** Serves `app` on `port` (0: any free port); resolves with its base URL once listening. */
export async function serve(
  app: App,
  port: number,
): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    handle(app, request, response).catch((error: unknown) => {
      send(response, 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(port, "0.0.0.0", resolve);
  });
  const { port: bound } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${String(bound)}` };
}
