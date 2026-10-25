import { BudgetExceededError, createApp } from "agboss";
import { TravelBookingRequestDto } from "../src/dto/travel-booking-request.dto.js";
import {
  getOperationLedgerEntries,
  getResourceState,
  resetOperationLedger,
} from "../src/services/operation-ledger.service.js";
import { TravelBookingSagaApplication } from "../src/travel-booking-saga.application.js";
import { BudgetSagaWorkflowStart } from "../src/workflow-starts/budget-saga.workflow-start.js";

export interface BudgetExceededScenarioResult {
  readonly rejectedWithBudgetExceeded: boolean;
  readonly errorMessage: string;
  readonly flightState: string | undefined;
  readonly hotelState: string | undefined;
  readonly ledgerEntries: ReturnType<typeof getOperationLedgerEntries>;
}

/**
 * Scenario B — Budget Exceeded Mid-Saga:
 * 1. Flight and hotel reservations succeed.
 * 2. `ItineraryBriefAgent` exceeds the $0.50 execution budget (`BudgetExceededError`).
 * 3. AGBoss automatically unwinds open compensations in LIFO order (`CancelHotelCompensationAction`,
 *    then `CancelFlightCompensationAction`) before rejecting the execution.
 */
export async function runBudgetExceededScenario(
  bookingId = "BUDGET-EXCEED-B1",
): Promise<BudgetExceededScenarioResult> {
  resetOperationLedger();
  const app = await createApp(TravelBookingSagaApplication);
  try {
    let rejectedWithBudgetExceeded = false;
    let errorMessage = "";
    try {
      await app.execute(
        BudgetSagaWorkflowStart,
        Object.assign(new TravelBookingRequestDto(), {
          bookingId,
          travelerId: "trav-02",
          flightCode: "JFK-LHR-202",
          hotelCode: "LONDON-SAVOY-3",
          totalAmountUsd: 3100,
          simulatePaymentDecline: false,
        }),
      );
    } catch (error) {
      rejectedWithBudgetExceeded = error instanceof BudgetExceededError;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    return {
      rejectedWithBudgetExceeded,
      errorMessage,
      flightState: getResourceState("airline", `FLIGHT-${bookingId}`),
      hotelState: getResourceState("hotel", `HOTEL-${bookingId}`),
      ledgerEntries: getOperationLedgerEntries(),
    };
  } finally {
    await app.close();
  }
}
