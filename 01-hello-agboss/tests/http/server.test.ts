import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHelloOfflineFetch } from "../../../scripts/tooling/offline-transports.js";
import { startHelloHttpServer, type RunningHttpServer } from "../../src/http/server.js";
import {
  startPricingApiStubServer,
  type PricingApiStubServer,
} from "../../src/services/pricing-catalog.service.js";

describe("HTTP Server (`src/http/server.ts`) — Multi-tenancy, Health Probes & Cancellation", () => {
  let pricingApi: PricingApiStubServer;
  let server: RunningHttpServer;

  beforeEach(async () => {
    pricingApi = await startPricingApiStubServer();
    server = await startHelloHttpServer({
      processEnv: {
        ...process.env,
        PRICING_API_BASE_URL: pricingApi.baseUrl,
      },
      providerFetch: createHelloOfflineFetch(),
    });
  });

  afterEach(async () => {
    await server.close();
    await pricingApi.close();
  });

  it("serves GET /health/live and GET /health/ready with HTTP 200 when healthy", async () => {
    const liveRes = await fetch(`${server.baseUrl}/health/live`);
    expect(liveRes.status).toBe(200);
    const liveBody = (await liveRes.json()) as { status: string };
    expect(liveBody.status).toBe("healthy");

    const readyRes = await fetch(`${server.baseUrl}/health/ready`);
    expect(readyRes.status).toBe(200);
    const readyBody = (await readyRes.json()) as { status: string };
    expect(readyBody.status).toBe("healthy");
  });

  it("executes POST /api/inquiries with tenant and user headers and hits PricingCatalogService over HTTP", async () => {
    const res = await fetch(`${server.baseUrl}/api/inquiries`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-globex",
        "x-tenant-plan": "enterprise",
        "x-user-id": "user-42",
        "x-thread-id": "thread-pricing-42",
      },
      body: JSON.stringify({
        customerId: "cust-42",
        question: "Can we get a pricing quote for the pro tier?",
        seats: 12,
      }),
    });

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      status: string;
      threadId: string;
      output: { handledBy: string; quotedMonthlyUsd: number };
    };
    expect(payload.status).toBe("finished");
    expect(payload.threadId).toBe("thread-pricing-42");
    expect(payload.output.handledBy).toBe("pricing");
    expect(pricingApi.requests.length).toBeGreaterThanOrEqual(1);
    expect(pricingApi.requests[0]?.idempotencyKey).toBeTruthy();

    // Cancel completed thread returns { cancelled: false }
    const cancelRes = await fetch(
      `${server.baseUrl}/api/threads/thread-pricing-42/cancel`,
      {
        method: "POST",
        headers: {
          "x-tenant-id": "tenant-globex",
          "x-user-id": "user-42",
        },
      },
    );
    expect(cancelRes.status).toBe(200);
    expect(await cancelRes.json()).toEqual({ cancelled: false });
  });
});
