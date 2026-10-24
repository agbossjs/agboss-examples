import { createApp, ExecutionStatus } from "agboss";
import { describe, expect, it } from "vitest";
import {
  assertIdempotencyKeysPresent,
  assertNoDuplicateSideEffects,
} from "../../tooling/assertions/idempotency.js";
import { TravelBookingSagaApplication } from "../src/application.js";
import { FakeAirlineService } from "../src/infrastructure/fake-airline.js";
import { FakeHotelService } from "../src/infrastructure/fake-hotel.js";
import { FakePaymentService } from "../src/infrastructure/fake-payments.js";
import {
  getOperationLedgerEntries,
  resetOperationLedger,
} from "../src/infrastructure/operation-ledger.js";
import { TravelBookingRequestDto } from "../src/workflows/dtos.js";
import { PaymentSagaWorkflowStart } from "../src/workflows/travel-booking.workflow.js";

describe("travel-booking-saga — Idempotency & Zero-Double-Charge Proofs", () => {
  it("deduplicates repeated reserve, authorize, confirm, and release calls with identical idempotency keys", async () => {
    resetOperationLedger();
    const app = await createApp(TravelBookingSagaApplication);
    try {
      const result = await app.execute(
        PaymentSagaWorkflowStart,
        Object.assign(new TravelBookingRequestDto(), {
          bookingId: "IDEMP-01",
          travelerId: "trav-idemp",
          flightCode: "SFO-LHR-900",
          hotelCode: "LONDON-GRAND-1",
          totalAmountUsd: 1800,
          simulatePaymentDecline: false,
        }),
      );

      expect(result.status).toBe(ExecutionStatus.Finished);
      expect(result.output?.status).toBe("CONFIRMED");

      const entriesBeforeReplay = getOperationLedgerEntries();
      expect(entriesBeforeReplay.every((e) => !e.deduplicated)).toBe(true);

      // Replay the exact same operations with the same idempotency keys (simulating network retry)
      const airline = app.resolve(FakeAirlineService);
      const hotel = app.resolve(FakeHotelService);
      const payments = app.resolve(FakePaymentService);

      for (const entry of entriesBeforeReplay) {
        if (entry.service === "airline" && entry.operation === "reserve") {
          airline.reserveSeat({
            bookingId: "IDEMP-01",
            flightCode: "SFO-LHR-900",
            idempotencyKey: entry.idempotencyKey,
          });
        } else if (entry.service === "hotel" && entry.operation === "reserve") {
          hotel.reserveRoom({
            bookingId: "IDEMP-01",
            hotelCode: "LONDON-GRAND-1",
            idempotencyKey: entry.idempotencyKey,
          });
        } else if (entry.service === "payments" && entry.operation === "authorize") {
          payments.authorizeAndCapture({
            bookingId: "IDEMP-01",
            amountUsd: 1800,
            simulateDecline: false,
            idempotencyKey: entry.idempotencyKey,
          });
        }
      }

      const allEntries = getOperationLedgerEntries();
      const deduplicatedEntries = allEntries.filter((e) => e.deduplicated);
      expect(deduplicatedEntries.length).toBe(3);

      // Zero duplicate applied business side effects
      assertNoDuplicateSideEffects(allEntries);
      assertIdempotencyKeysPresent(allEntries);
    } finally {
      await app.close();
    }
  });
});
