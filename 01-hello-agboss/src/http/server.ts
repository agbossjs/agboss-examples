import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createApp,
  ExecutionStatus,
  HealthStatus,
  type App,
} from "@agboss/core";
import type { CustomerInquiryDto } from "../dto/customer-inquiry.dto.js";
import { HelloAgbossApplication } from "../hello-agboss.application.js";
import { HelloWorkflowStart } from "../workflows/hello-agboss/hello.workflow-start.js";

export type HelloServerOptions = NonNullable<Parameters<typeof createApp>[1]>;

export interface RunningHttpServer {
  readonly app: App;
  readonly baseUrl: string;
  close(): Promise<void>;
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve();
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
  const raw = Buffer.concat(chunks).toString("utf8");
  return (raw.trim() === "" ? {} : JSON.parse(raw)) as T;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

function headerOf(req: IncomingMessage, name: string, fallback: string): string {
  const value = req.headers[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

/**
 * Boots `HelloAgbossApplication` once (`await createApp(...)`) and exposes an HTTP server
 * demonstrating multi-tenant execution, pause/resume webhooks, thread cancellation,
 * Kubernetes/ECS liveness & readiness probes, and graceful shutdown (`await app.close()`).
 */
export async function startHelloHttpServer(
  options: HelloServerOptions = {},
): Promise<RunningHttpServer> {
  const app = await createApp(HelloAgbossApplication, options);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handleRequest(app, req, res);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });
  const address = server.address() as AddressInfo;

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    await app.close();
  };

  return {
    app,
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    close,
  };
}

async function handleRequest(
  app: App,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname;

  try {
    if (method === "GET" && pathname === "/health/live") {
      const report = await app.checkLiveness();
      const code = report.status === HealthStatus.Unhealthy ? 503 : 200;
      sendJson(res, code, report);
      return;
    }

    if (method === "GET" && pathname === "/health/ready") {
      const report = await app.checkReadiness();
      const code = report.status === HealthStatus.Unhealthy ? 503 : 200;
      sendJson(res, code, report);
      return;
    }

    if (method === "POST" && pathname === "/api/inquiries") {
      const tenantId = headerOf(req, "x-tenant-id", "tenant-acme");
      const planHeader = headerOf(req, "x-tenant-plan", "pro");
      const plan: "starter" | "pro" | "enterprise" =
        planHeader === "starter" || planHeader === "enterprise" ? planHeader : "pro";
      const userId = headerOf(req, "x-user-id", "user-1");
      const threadIdHeader = req.headers["x-thread-id"];
      const threadId =
        typeof threadIdHeader === "string" && threadIdHeader.trim() !== ""
          ? threadIdHeader.trim()
          : undefined;

      const inputDto = await readJsonBody<CustomerInquiryDto>(req);
      const result = await app.execute(HelloWorkflowStart, inputDto, {
        ...(threadId ? { threadId } : {}),
        ownerId: userId,
        tenant: { tenantId, plan },
        execution: { userId },
      });

      if (result.status === ExecutionStatus.Paused) {
        sendJson(res, 202, {
          status: "paused",
          threadId: result.threadId,
          executionId: result.executionId,
          pending: result.pending,
        });
        return;
      }

      sendJson(res, 200, {
        status: "finished",
        threadId: result.threadId,
        executionId: result.executionId,
        output: result.output,
      });
      return;
    }

    const pauseMatch = /^\/api\/pauses\/([^/]+)\/resume$/u.exec(pathname);
    if (method === "POST" && pauseMatch?.[1]) {
      const pauseId = decodeURIComponent(pauseMatch[1]);
      const tenantId = headerOf(req, "x-tenant-id", "tenant-acme");
      const userId = headerOf(req, "x-user-id", "user-1");
      const body = await readJsonBody<{
        reply?: string;
        decision?: unknown;
        answeredBy?: string;
      }>(req);

      const resumeRequest =
        typeof body.reply === "string"
          ? { pauseId, reply: body.reply }
          : { pauseId, decision: body.decision };
      const resumeOptions =
        typeof body.answeredBy === "string"
          ? { tenantId, answeredBy: body.answeredBy }
          : { tenantId, ownerId: userId };

      const result = await app.resume(resumeRequest, resumeOptions);
      sendJson(res, result.status === ExecutionStatus.Paused ? 202 : 200, {
        status: result.status,
        threadId: result.threadId,
        executionId: result.executionId,
        output: result.output,
        pending: result.pending,
      });
      return;
    }

    const cancelMatch = /^\/api\/threads\/([^/]+)\/cancel$/u.exec(pathname);
    if (method === "POST" && cancelMatch?.[1]) {
      const threadId = decodeURIComponent(cancelMatch[1]);
      const tenantId = headerOf(req, "x-tenant-id", "tenant-acme");
      const userId = headerOf(req, "x-user-id", "user-1");
      const outcome = await app.cancel(threadId, { tenantId, ownerId: userId });
      sendJson(res, 200, outcome);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
