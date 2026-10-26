import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp, ExecutionStatus, HealthStatus, type App } from "@agboss/core";
import { ToolCallApprovalDecisionDto } from "@agboss/core/dto";
import { getSentChannelAsks } from "../channels/corporate-booking-approval.channel.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";
import { TravelBookingSagaApplication } from "../travel-booking-saga.application.js";
import { HitlHoldSagaWorkflowStart } from "../workflows/hitl-hold-saga/hitl-hold-saga.workflow-start.js";
import { PaymentSagaWorkflowStart } from "../workflows/payment-saga/payment-saga.workflow-start.js";

export interface RunningTravelHttpServer {
  readonly app: App;
  readonly baseUrl: string;
  readonly port: number;
  close(): Promise<void>;
}

/**
 * Production-ready Node HTTP adapter around `createApp(TravelBookingSagaApplication)`.
 *
 * Demonstrates:
 * - `POST /api/bookings` -> Executes `PaymentSagaWorkflowStart` (`200 OK`)
 * - `POST /api/bookings/hold` -> Executes `HitlHoldSagaWorkflowStart`, returning `202 Accepted`
 *   with `{ status: "paused", threadId, pending, pauseId }` when waiting on human approval
 * - `POST /api/pauses/:pauseId/resume` -> Resumes a paused execution via `app.resume({ pauseId, decision })`
 * - `POST /api/threads/:threadId/cancel` -> Cancels a paused execution and triggers LIFO compensation via `app.cancel(threadId)`
 * - `GET /health/live` & `GET /health/ready` -> Maps `app.liveness()` / `app.readiness()`
 * - Graceful shutdown (`close()` stops accepting HTTP requests and calls `await app.close()`)
 */
export async function startTravelHttpServer(
  options: {
    readonly port?: number;
    readonly appOptions?: NonNullable<Parameters<typeof createApp>[1]>;
  } = {},
): Promise<RunningTravelHttpServer> {
  const app = await createApp(TravelBookingSagaApplication, options.appOptions);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handleRequest(app, req, res);
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      resolve();
    });
  });

  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    app,
    baseUrl,
    port: addr.port,
    async close(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
      await app.close();
    },
  };
}

async function handleRequest(
  app: App,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");

  if (req.method === "GET" && url.pathname === "/health/live") {
    const report = await app.checkLiveness();
    sendJson(res, report.status !== HealthStatus.Unhealthy ? 200 : 503, report);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health/ready") {
    const report = await app.checkReadiness();
    sendJson(res, report.status !== HealthStatus.Unhealthy ? 200 : 503, report);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bookings") {
    const body = await readJsonBody<Partial<TravelBookingRequestDto>>(req);
    const input = Object.assign(new TravelBookingRequestDto(), {
      bookingId: body.bookingId ?? "HTTP-BK-1",
      travelerId: body.travelerId ?? "trav-http",
      flightCode: body.flightCode ?? "SFO-NRT-101",
      hotelCode: body.hotelCode ?? "TOKYO-GRAND-5",
      totalAmountUsd: body.totalAmountUsd ?? 1900,
      simulatePaymentDecline: body.simulatePaymentDecline ?? false,
    });

    const result = await app.execute(PaymentSagaWorkflowStart, input);
    sendJson(res, 200, {
      status: result.status,
      executionId: result.executionId,
      threadId: result.threadId,
      output: result.output,
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bookings/hold") {
    const body = await readJsonBody<Partial<TravelBookingRequestDto>>(req);
    const input = Object.assign(new TravelBookingRequestDto(), {
      bookingId: body.bookingId ?? "HTTP-HOLD-1",
      travelerId: body.travelerId ?? "trav-http-hold",
      flightCode: body.flightCode ?? "LAX-HND-303",
      hotelCode: body.hotelCode ?? "SHIBUYA-STAY-4",
      totalAmountUsd: body.totalAmountUsd ?? 4200,
      simulatePaymentDecline: body.simulatePaymentDecline ?? false,
    });

    const result = await app.execute(HitlHoldSagaWorkflowStart, input);

    if (result.status === ExecutionStatus.Paused) {
      const asks = getSentChannelAsks();
      const latestPauseId = asks[asks.length - 1]?.pauseId ?? result.pending[0]?.pauseId;
      sendJson(res, 202, {
        status: "paused",
        executionId: result.executionId,
        threadId: result.threadId,
        pauseId: latestPauseId,
        pending: result.pending,
      });
      return;
    }

    sendJson(res, 200, {
      status: result.status,
      executionId: result.executionId,
      threadId: result.threadId,
      output: result.output,
    });
    return;
  }

  const resumeMatch = /^\/api\/pauses\/([^/]+)\/resume$/.exec(url.pathname);
  if (req.method === "POST" && resumeMatch?.[1] !== undefined) {
    const pauseId = decodeURIComponent(resumeMatch[1]);
    const body = await readJsonBody<{
      readonly approved?: boolean;
      readonly reason?: string;
      readonly answeredBy?: string;
    }>(req);

    try {
      const result = await app.resume(
        {
          pauseId,
          decision: Object.assign(new ToolCallApprovalDecisionDto(), {
            approved: body.approved ?? true,
            reason: body.reason ?? "Approved via HTTP webhook",
          }),
        },
        { answeredBy: body.answeredBy ?? "http-manager" },
      );

      sendJson(res, 200, {
        status: result.status,
        executionId: result.executionId,
        threadId: result.threadId,
        output: result.output,
      });
    } catch (error) {
      sendJson(res, 409, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  const cancelMatch = /^\/api\/threads\/([^/]+)\/cancel$/.exec(url.pathname);
  if (req.method === "POST" && cancelMatch?.[1] !== undefined) {
    const threadId = decodeURIComponent(cancelMatch[1]);
    const result = await app.cancel(threadId);
    sendJson(res, 200, result);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? (JSON.parse(raw) as T) : ({} as T);
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}
