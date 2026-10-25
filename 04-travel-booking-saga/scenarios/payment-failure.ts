import {
  CompensationReason,
  CompensationStatus,
  createApp,
  ExecutionStatus,
} from "agboss";
import { TravelBookingRequestDto } from "../src/dto/travel-booking-request.dto.js";
import {
  getOperationLedgerEntries,
  getResourceState,
  resetOperationLedger,
} from "../src/services/operation-ledger.service.js";
import { TravelBookingSagaApplication } from "../src/travel-booking-saga.application.js";
import { PaymentSagaWorkflowStart } from "../src/workflows/payment-saga/payment-saga.workflow-start.js";

export interface PaymentFailureScenarioResult {
  readonly status: ExecutionStatus;
  readonly outcomeStatus: string | undefined;
  readonly compensations: readonly {
    readonly compensatedNode: string;
    readonly compensatorNode: string;
    readonly reason: CompensationReason;
    readonly status: CompensationStatus;
  }[];
  readonly flightState: string | undefined;
  readonly hotelState: string | undefined;
  readonly ledgerEntries: ReturnType<typeof getOperationLedgerEntries>;
}

/**
 * Scenario A — Payment Failure & LIFO Rollback:
 * 1. Flight reservation succeeds (`FLIGHT-SCENARIO-A`).
 * 2. Hotel reservation succeeds (`HOTEL-SCENARIO-A`).
 * 3. Payment capture throws `PaymentDeclinedError`.
 * 4. Side-path runs `CancelHotelCompensationAction` then `CancelFlightCompensationAction` (LIFO).
 */
export async function runPaymentFailureScenario(
  bookingId = "SCENARIO-A",
): Promise<PaymentFailureScenarioResult> {
  resetOperationLedger();
  const app = await createApp(TravelBookingSagaApplication);
  try {
    const result = await app.execute(
      PaymentSagaWorkflowStart,
      Object.assign(new TravelBookingRequestDto(), {
        bookingId,
        travelerId: "trav-01",
        flightCode: "SFO-NRT-101",
        hotelCode: "TOKYO-GRAND-5",
        totalAmountUsd: 2400,
        simulatePaymentDecline: true,
      }),
    );

    return {
      status: result.status,
      outcomeStatus: result.output?.status,
      compensations: result.compensations.map((c) => ({
        compensatedNode: c.compensated.nodeId,
        compensatorNode: c.compensator.name,
        reason: c.reason,
        status: c.status,
      })),
      flightState: getResourceState("airline", `FLIGHT-${bookingId}`),
      hotelState: getResourceState("hotel", `HOTEL-${bookingId}`),
      ledgerEntries: getOperationLedgerEntries(),
    };
  } finally {
    await app.close();
  }
}
