import { describe, expect, it } from "vitest";
import { resetChannelRecords } from "../../src/channels/corporate-booking-approval.channel.js";
import { startTravelHttpServer } from "../../src/http/server.js";
import {
  getResourceState,
  resetOperationLedger,
} from "../../src/services/operation-ledger.service.js";

describe("TravelHTTPServer (src/http/server.ts)", () => {
  it("returns 202 Accepted on HITL pause, resumes via POST /api/pauses/:pauseId/resume, cancels via POST /api/threads/:threadId/cancel, and serves /health/live & /health/ready", async () => {
    resetOperationLedger();
    resetChannelRecords();
    const server = await startTravelHttpServer();
    try {
      // 1. Liveness & readiness probes
      const liveRes = await fetch(`${server.baseUrl}/health/live`);
      expect(liveRes.status).toBe(200);
      const liveBody = (await liveRes.json()) as { status: string };
      expect(liveBody.status).toBe("healthy");

      const readyRes = await fetch(`${server.baseUrl}/health/ready`);
      expect(readyRes.status).toBe(200);
      const readyBody = (await readyRes.json()) as { status: string };
      expect(readyBody.status).toBe("healthy");

      // 2. POST /api/bookings/hold pauses waiting for human approval -> 202 Accepted
      const holdRes = await fetch(`${server.baseUrl}/api/bookings/hold`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId: "HTTP-HOLD-APPROVE",
          travelerId: "trav-http-1",
          flightCode: "LAX-HND-303",
          hotelCode: "SHIBUYA-STAY-4",
          totalAmountUsd: 4200,
        }),
      });
      expect(holdRes.status).toBe(202);
      const holdBody = (await holdRes.json()) as {
        status: string;
        threadId: string;
        pauseId: string;
      };
      expect(holdBody.status).toBe("paused");
      expect(holdBody.pauseId).toBeTruthy();

      // 3. POST /api/pauses/:pauseId/resume completes the paused saga -> 200 OK
      const resumeRes = await fetch(
        `${server.baseUrl}/api/pauses/${encodeURIComponent(holdBody.pauseId)}/resume`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            approved: true,
            reason: "Approved via HTTP test",
            answeredBy: "vp-travel",
          }),
        },
      );
      expect(resumeRes.status).toBe(200);
      const resumeBody = (await resumeRes.json()) as {
        status: string;
        output: { status: string };
      };
      expect(resumeBody.status).toBe("finished");
      expect(resumeBody.output.status).toBe("CONFIRMED");

      // 4. Start a second hold and cancel via POST /api/threads/:threadId/cancel -> LIFO rollback
      const holdCancelRes = await fetch(`${server.baseUrl}/api/bookings/hold`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId: "HTTP-HOLD-CANCEL",
          travelerId: "trav-http-2",
          flightCode: "SFO-LHR-101",
          hotelCode: "LONDON-SAVOY-3",
          totalAmountUsd: 4800,
        }),
      });
      expect(holdCancelRes.status).toBe(202);
      const holdCancelBody = (await holdCancelRes.json()) as {
        threadId: string;
      };

      const cancelRes = await fetch(
        `${server.baseUrl}/api/threads/${encodeURIComponent(holdCancelBody.threadId)}/cancel`,
        { method: "POST" },
      );
      expect(cancelRes.status).toBe(200);
      const cancelBody = (await cancelRes.json()) as { cancelled: boolean };
      expect(cancelBody.cancelled).toBe(true);
      expect(getResourceState("hotel", "HOTEL-HTTP-HOLD-CANCEL")).toBe("RELEASED");
      expect(getResourceState("airline", "FLIGHT-HTTP-HOLD-CANCEL")).toBe("RELEASED");
    } finally {
      await server.close();
    }
  });
});
